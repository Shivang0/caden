"use client";

// One-take voice cloning on the Connections page. The founder reads a fixed
// ~20 second script, we record it in the browser, clone it via ElevenLabs and
// pin the voice to their profile. Every video caden generates then speaks in
// their voice, on any device, no localStorage involved.

import { useEffect, useRef, useState } from "react";

const SCRIPT =
  "Okay, sound check. I am recording this so caden can learn my voice: the pace, " +
  "the pauses, all of it. This week we shipped more than I expected, honestly. " +
  "Next week the bar goes up again. If this sounds like me, we are good. " +
  "Ship the work, send the update.";

const MIN_SECONDS = 10;
const MAX_SECONDS = 30;

type Phase = "loading" | "idle" | "recording" | "uploading" | "ready" | "error";

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the recording."));
    reader.readAsDataURL(blob);
  });
}

export function VoiceCard() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    fetch("/portal/api/voice/clone")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { voiceReady?: boolean } | null) => {
        if (!active) return;
        setPhase(d?.voiceReady ? "ready" : "idle");
      })
      .catch(() => {
        if (active) setPhase("idle");
      });
    return () => {
      active = false;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
    };
  }, []);

  async function upload(blob: Blob, mime: string) {
    setPhase("uploading");
    setMessage(null);
    try {
      const audio_b64 = await blobToB64(blob);
      const res = await fetch("/portal/api/voice/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_b64, mime }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Clone failed (${res.status}).`);
      setPhase("ready");
      setMessage("Voice cloned and pinned to your profile.");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Clone failed.");
    }
  }

  async function toggleRecord() {
    if (recRef.current && recRef.current.state === "recording") {
      recRef.current.stop();
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("error");
      setMessage("Microphone blocked. Allow mic access and try again.");
      return;
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      stream.getTracks().forEach((t) => t.stop());
      const took = Math.round((Date.now() - startedAtRef.current) / 1000);
      if (took < MIN_SECONDS) {
        setPhase("error");
        setMessage(`Too short (${took}s). Read the whole script, about 20 seconds.`);
        return;
      }
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      void upload(blob, rec.mimeType || "audio/webm");
    };
    startedAtRef.current = Date.now();
    rec.start(250);
    setPhase("recording");
    setSeconds(0);
    setMessage(null);
    timerRef.current = window.setInterval(() => {
      const s = Math.round((Date.now() - startedAtRef.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
  }

  const busy = phase === "uploading";

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-5 transition-colors hover:border-[#363636]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#363636] bg-[#212121] text-lg text-[#f9fe2e]"
            aria-hidden="true"
          >
            ♪
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[#f1f1f1]">Your voice</span>
              {phase === "ready" && (
                <span className="caden-pill inline-flex items-center gap-1.5 border border-[#f9fe2e]/40 bg-[#f9fe2e]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#f9fe2e]">
                  <span className="h-1.5 w-1.5 bg-[#f9fe2e]" />
                  Voice ready
                </span>
              )}
            </div>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-[#b5b5b5]">
              Read the script below once, about 20 seconds. We clone it and every
              video caden makes speaks in your voice. Your own voice only.
            </p>
            <blockquote className="mt-3 max-w-md rounded-xl border border-[#363636] bg-[#1a1a1a] px-4 py-3 text-sm italic leading-relaxed text-[#cfcfcf]">
              “{SCRIPT}”
            </blockquote>
            {message && (
              <p
                className={`mt-2 text-xs ${phase === "error" ? "text-[#ff7a6e]" : "text-[#8f8f8f]"}`}
              >
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 pl-14 sm:pl-0">
          <button
            type="button"
            onClick={() => void toggleRecord()}
            disabled={busy || phase === "loading"}
            className={`caden-pill px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              phase === "recording"
                ? "bg-[#ff7a6e] text-[#161616] hover:bg-[#ff8f85]"
                : "bg-[#f9fe2e] text-[#161616] hover:scale-[1.04] hover:bg-[#ffe042]"
            }`}
          >
            {phase === "recording"
              ? `Stop (${seconds}s)`
              : busy
                ? "Cloning…"
                : phase === "ready"
                  ? "Re-record"
                  : "Record my voice"}
          </button>
        </div>
      </div>
    </div>
  );
}
