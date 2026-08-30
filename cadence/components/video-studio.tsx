"use client";

// Video studio: the founder cameo, UGC style. One button renders a single
// muxed mp4: the founder's photo animated on a Modal H200 (Wan 2.2) with a
// casual spoken script in the founder's OWN cloned voice (pinned on the
// Connections page). No generic narrator, no separate audio track — voice is
// muxed into the file server-side. The old slideshow exporter is gone on
// purpose: the founder asked for exactly one artifact, video with their voice.

import { useEffect, useRef, useState } from "react";
import type { VideoStudioProps } from "@/lib/types";

// Same pipeline endpoints the live demo page uses (same origin): the scene
// director + voice + photo search live on the static app, the GPU on Modal.
const MODAL_VIDEO_URL = "https://johnhopper0123--caden-video-api.modal.run/video";

const panel = "rounded-2xl border border-[#2a2a2a] bg-[#161616] p-5";

type Phase =
  | "checking"
  | "no_voice"
  | "ready"
  | "photo"
  | "directing"
  | "voicing"
  | "rendering"
  | "done"
  | "error";

async function fetchRetry(url: string, init?: RequestInit, tries = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network failed.");
}

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}

/** Downscale an uploaded photo to <=1280px JPEG base64 (what Wan expects). */
function photoToB64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.92).split(",")[1] ?? "");
    };
    img.onerror = () => resolve("");
    img.src = URL.createObjectURL(file);
  });
}

export function VideoStudio({ artifacts }: VideoStudioProps) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [status, setStatus] = useState("Checking your cloned voice…");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [founderName, setFounderName] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);

  // The source text: the build-in-public post reads best on camera.
  const sourceText = artifacts.linkedinPost.trim() || artifacts.investorUpdate.trim();

  useEffect(() => {
    cancelledRef.current = false;
    Promise.all([
      fetch("/portal/api/voice/clone").then((r) => (r.ok ? r.json() : null)),
      fetch("/portal/api/autopilot").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([voice, auto]: Array<{ voiceId?: string | null; founder?: { name?: string } } | null>) => {
        if (cancelledRef.current) return;
        const id = voice?.voiceId ?? null;
        setFounderName(auto?.founder?.name ?? "");
        if (id) {
          setVoiceId(id);
          setPhase("ready");
          setStatus("Voice ready. One click renders your cameo.");
        } else {
          setPhase("no_voice");
        }
      })
      .catch(() => {
        if (!cancelledRef.current) setPhase("no_voice");
      });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function generate() {
    if (!voiceId) return;
    if (!sourceText) {
      setPhase("error");
      setStatus("Generate an update first, then come back for the video.");
      return;
    }
    setVideoUrl(null);
    try {
      // 1. The founder's face: uploaded photo, else LinkedIn/Google search.
      setPhase("photo");
      const file = photoRef.current?.files?.[0];
      let imageB64 = "";
      let imageUrls: string[] = [];
      if (file) {
        setStatus("Reading your photo…");
        imageB64 = await photoToB64(file);
      }
      if (!imageB64) {
        setStatus("Finding your photo on LinkedIn and Google…");
        const found = await fetchRetry("/api/founder-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: founderName, repo: artifacts.company }),
        });
        if (!found.ok) throw new Error("No photo found. Upload one above and retry.");
        imageUrls = ((await found.json()) as { imageUrls?: string[] }).imageUrls ?? [];
        if (imageUrls.length === 0) throw new Error("No photo found. Upload one above and retry.");
      }

      // 2. UGC direction: handheld selfie scene + casual first-person script.
      setPhase("directing");
      setStatus("Writing your talking-to-camera script…");
      let scenePrompt = "";
      let script = "";
      try {
        const scene = await fetchRetry("/api/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceText }),
        });
        if (scene.ok) {
          const parsed = (await scene.json()) as { prompt?: string; script?: string };
          scenePrompt = parsed.prompt ?? "";
          script = parsed.script ?? "";
        }
      } catch {
        // fall through: the Modal worker has a UGC default prompt
      }

      // 3. The voiceover, in the founder's cloned voice, casual delivery.
      setPhase("voicing");
      setStatus("Recording the voiceover in your voice…");
      const voice = await fetchRetry("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script || sourceText.slice(0, 320),
          voiceId,
          casual: Boolean(script),
        }),
      });
      if (!voice.ok) {
        const err = (await voice.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Voiceover failed (${voice.status}).`);
      }
      const audioB64 = await blobToB64(await voice.blob());

      // 4a. First choice: the elevenlabs-i2v renderer — authentic founder
      // scene with a polished finish — then the cloned voice muxed in server
      // side. One mp4, voice attached. Falls through to the H200 on failure.
      setPhase("rendering");
      try {
        const i2vPrompt = (
          (scenePrompt || "") +
          " Smooth confident motion, crisp focus, high production value, no readable text or logos."
        ).slice(0, 500);
        setStatus("Submitting to the ElevenLabs i2v renderer…");
        const submit2 = await fetchRetry("/api/i2v", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_b64: imageB64, image_urls: imageUrls, prompt: i2vPrompt }),
        });
        if (!submit2.ok) throw new Error(`i2v submit ${submit2.status}`);
        const { id: jobId } = (await submit2.json()) as { id: string };
        const t0 = Date.now();
        let outputUrl: string | null = null;
        let sawProcessing = false;
        while (Date.now() - t0 < 480_000) {
          if (cancelledRef.current) return;
          await new Promise((ok) => setTimeout(ok, 5000));
          setElapsed(Math.round((Date.now() - t0) / 1000));
          let poll2: Response;
          try {
            poll2 = await fetchRetry(`/api/i2v?id=${encodeURIComponent(jobId)}`);
          } catch {
            continue;
          }
          if (!poll2.ok) continue;
          const js = (await poll2.json()) as {
            status: string;
            position: number | null;
            outputUrl: string | null;
            error: string | null;
          };
          if (js.status === "processing") sawProcessing = true;
          if (js.status === "done" && js.outputUrl) {
            outputUrl = js.outputUrl;
            break;
          }
          if (js.status === "failed") throw new Error(js.error ?? "i2v render failed");
          // No render worker attached? The job never leaves "queued". Fall
          // through to the H200 after 90s rather than waiting the full window.
          if (!sawProcessing && Date.now() - t0 > 90_000) throw new Error("no i2v worker");
          setStatus(
            `ElevenLabs i2v ${sawProcessing ? "rendering" : "queued"}${js.position ? `, spot ${js.position}` : ""}…`
          );
        }
        if (!outputUrl) throw new Error("i2v timed out");
        setStatus("Layering your voice over the render…");
        const mux = await fetchRetry("/api/i2v", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mux: true, video_url: outputUrl, audio_b64: audioB64 }),
        });
        if (!mux.ok) throw new Error(`voice mux ${mux.status}`);
        setVideoUrl(URL.createObjectURL(await mux.blob()));
        setPhase("done");
        setStatus("Done. One file, your face, your voice. Post it with the update.");
        return;
      } catch (i2vError) {
        setStatus(
          `i2v path unavailable (${i2vError instanceof Error ? i2vError.message : "error"}). Using the H200 instead…`
        );
      }

      // 4b. GPU render. The worker muxes the voice with ffmpeg, so the file
      // that comes back is ONE mp4 with your voice attached.
      setStatus("Animating your photo on an H200. About two minutes.");
      const submit = await fetchRetry(MODAL_VIDEO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_b64: imageB64,
          image_urls: imageUrls,
          prompt: scenePrompt,
          audio_b64: audioB64,
        }),
      });
      if (!submit.ok) {
        const err = (await submit.json().catch(() => ({}))) as { detail?: string };
        throw new Error(err.detail ?? `GPU submit failed (${submit.status}).`);
      }
      const { call_id: callId } = (await submit.json()) as { call_id: string };
      const resultUrl = MODAL_VIDEO_URL.replace(/\/video$/, "/result/") + callId;

      const startedAt = Date.now();
      for (;;) {
        if (cancelledRef.current) return;
        if (Date.now() - startedAt > 600_000) throw new Error("GPU render timed out.");
        await new Promise((ok) => setTimeout(ok, 5000));
        setElapsed(Math.round((Date.now() - startedAt) / 1000));
        let poll: Response;
        try {
          poll = await fetchRetry(resultUrl);
        } catch {
          setStatus("Connection blip, still rendering. Retrying…");
          continue;
        }
        if (poll.status === 202) continue;
        if (!poll.ok) {
          const err = (await poll.json().catch(() => ({}))) as { detail?: string };
          throw new Error(err.detail ?? `GPU render failed (${poll.status}).`);
        }
        setVideoUrl(URL.createObjectURL(await poll.blob()));
        break;
      }
      setPhase("done");
      setStatus("Done. One file, your face, your voice. Post it with the update.");
    } catch (error) {
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "Video generation failed.");
    }
  }

  const busy = phase === "photo" || phase === "directing" || phase === "voicing" || phase === "rendering";

  return (
    <div className="flex flex-col gap-4">
      <div className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-md">
            <h3 className="text-base font-medium tracking-tight text-[#f1f1f1]">
              Founder cameo
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#b5b5b5]">
              Your photo, animated, talking through this update in your own
              cloned voice. Shot like a phone selfie vlog, rendered as one mp4
              with the audio attached.
            </p>
            {phase === "no_voice" && (
              <p className="mt-3 rounded-xl border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-4 py-3 text-sm text-[#f1f1f1]/90">
                No cloned voice on your profile yet. Record the 20 second
                script on the{" "}
                <a
                  href="/portal/connections"
                  className="font-medium text-[#f9fe2e] underline underline-offset-2"
                >
                  Connections page
                </a>{" "}
                first; every video after that speaks in your voice.
              </p>
            )}
            <div className="mt-4">
              <label
                htmlFor="cameo-photo"
                className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#8f8f8f]"
              >
                Your photo (optional, beats the LinkedIn search)
              </label>
              <input
                id="cameo-photo"
                ref={photoRef}
                type="file"
                accept="image/*"
                disabled={busy}
                className="block w-full text-sm text-[#b5b5b5] file:mr-3 file:rounded-lg file:border-0 file:bg-[#212121] file:px-3 file:py-1.5 file:text-sm file:text-[#f1f1f1]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || phase === "checking" || phase === "no_voice"}
            className="caden-pill bg-[#f9fe2e] px-5 py-2.5 text-sm font-medium text-[#161616] transition-[background-color,transform] duration-200 hover:scale-[1.04] hover:bg-[#ffe042] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Rendering…" : phase === "done" ? "Render again" : "Make my video"}
          </button>
        </div>

        <p
          role="status"
          className={`mt-4 font-mono text-[11px] uppercase tracking-[0.1em] ${
            phase === "error" ? "text-[#ff7a6e]" : "text-[#8f8f8f]"
          }`}
        >
          {status}
          {phase === "rendering" && elapsed > 0 ? ` ${elapsed}s in.` : ""}
        </p>
      </div>

      {videoUrl && (
        <div className={panel}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#8f8f8f]">
              ( your cameo, voice attached )
            </span>
            <a
              href={videoUrl}
              download="caden-founder-cameo.mp4"
              className="caden-pill border border-[#363636] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#b5b5b5] transition-colors hover:border-[#676767] hover:text-[#f1f1f1]"
            >
              Download mp4
            </a>
          </div>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl bg-black" />
        </div>
      )}
    </div>
  );
}
