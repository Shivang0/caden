// caden video via ElevenLabs (Pro): Veo 3.1 clip from the founder's photo,
// voiceover in the founder's cloned voice, muxed with ffmpeg.
// POST { text, prompt, image_b64, image_urls, voiceId } -> video/mp4 bytes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, rm } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const config = {
  maxDuration: 300,
};

const ELEVEN = "https://api.elevenlabs.io";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const VIDEO_MODEL = "veo-3.1-fast-generate-001";

// First few sentences of the post, cleaned of labels and PR references,
// capped so the voiceover stays around twenty seconds.
function buildScript(text) {
  let t = text
    .replace(/LINKEDIN POST|X THREAD/g, " ")
    .replace(/\(#\d+[^)]*\)/g, "")
    .replace(/[#*_`>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = t.match(/[^.!?]+[.!?]/g) || [t];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 320) break;
    out += s.trim() + " ";
  }
  return out.trim() || t.slice(0, 300);
}

const FALLBACK_PROMPT = [
  "Cinematic teaser for a software startup shipping fast.",
  "The person in the first frame comes alive with subtle natural motion, breathing and blinking,",
  "a dark charcoal workspace behind them, electric yellow accent light sweeping slowly,",
  "confident camera push-in, shallow depth of field, high contrast, crisp and modern.",
  "No readable text, no words, no logos on screen.",
].join(" ");

async function elevenFetch(key, path, init) {
  return fetch(`${ELEVEN}${path}`, {
    ...init,
    headers: { "xi-api-key": key, ...(init && init.headers) },
  });
}

// Server-side image fetch for the Linkup path, so the browser never has to
// read cross-origin image bytes.
async function urlToB64(urls) {
  for (const url of urls || []) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4096) continue;
      const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
      if (!/^image\//.test(mime)) continue;
      return { b64: buf.toString("base64"), mime };
    } catch (err) {
      continue;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const key = (process.env.ELEVEN_KEY_V2 || process.env.ELEVENLABS_API_KEY);
  if (!key) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured on the server." });
    return;
  }

  const body = req.body || {};
  const text = (body.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required." });
    return;
  }

  const stamp = Date.now();
  const vidPath = `/tmp/caden-${stamp}-clip.mp4`;
  const audPath = `/tmp/caden-${stamp}-voice.mp3`;
  const outPath = `/tmp/caden-${stamp}-final.mp4`;

  try {
    // 1. The founder's photo as the first frame
    let frame = null;
    if ((body.image_b64 || "").trim()) {
      frame = { b64: body.image_b64.trim(), mime: "image/jpeg" };
    } else if (Array.isArray(body.image_urls) && body.image_urls.length) {
      frame = await urlToB64(body.image_urls.slice(0, 6));
    }

    // 2. Start the Veo job (fails fast if the plan changed)
    const payload = {
      model_id: VIDEO_MODEL,
      prompt: (body.prompt || "").trim() || FALLBACK_PROMPT,
      duration_secs: 8,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: false,
    };
    if (frame) {
      payload.start_frame = {
        type: "inline_base64",
        content_base64: frame.b64,
        mime_type: frame.mime,
      };
    }
    const createR = await elevenFetch(key, "/v1/flows/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!createR.ok) {
      const errBody = await createR.text();
      if (createR.status === 402) {
        throw new Error("plan_blocked: video via the ElevenLabs API needs a Pro plan or above.");
      }
      throw new Error(`Video create failed (${createR.status}): ${errBody.slice(0, 200)}`);
    }
    const { id } = await createR.json();

    // 3. Voiceover in the founder's voice while the clip renders
    const script = buildScript(text);
    const requested = (body.voiceId || "").trim();
    const voiceId = /^[A-Za-z0-9]{8,40}$/.test(requested)
      ? requested
      : process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
    const ttsR = await elevenFetch(key, `/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!ttsR.ok) {
      const errBody = await ttsR.text();
      throw new Error(`Voiceover failed (${ttsR.status}): ${errBody.slice(0, 160)}`);
    }
    await writeFile(audPath, Buffer.from(await ttsR.arrayBuffer()));

    // 4. Poll until the clip is ready
    let clipUrl = null;
    for (let i = 0; i < 21; i++) {
      await new Promise((ok) => setTimeout(ok, 10000));
      const pollR = await elevenFetch(key, `/v1/flows/video/${id}`, { method: "GET" });
      if (!pollR.ok) continue;
      const gen = await pollR.json();
      if (gen.status === "completed") {
        clipUrl = gen.content_url;
        break;
      }
      if (gen.status === "failed" || gen.status === "rejected") {
        throw new Error(`Video generation ${gen.status}: ${(gen.error || "").toString().slice(0, 160)}`);
      }
    }
    if (!clipUrl) throw new Error("Video generation timed out. Try again in a minute.");

    const clipR = await fetch(clipUrl);
    if (!clipR.ok) throw new Error(`Could not download the clip (${clipR.status}).`);
    await writeFile(vidPath, Buffer.from(await clipR.arrayBuffer()));

    // 5. Loop the clip under the voiceover and mux
    await execFileAsync(ffmpegPath, [
      "-y",
      "-stream_loop", "-1",
      "-i", vidPath,
      "-i", audPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      outPath,
    ], { timeout: 60000 });

    const finalVideo = await readFile(outPath);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": finalVideo.length,
      "Cache-Control": "no-store",
    });
    res.end(finalVideo);
  } catch (err) {
    res.status(502).json({ error: err.message || "Video generation failed." });
  } finally {
    await Promise.all([rm(vidPath, { force: true }), rm(audPath, { force: true }), rm(outPath, { force: true })]).catch(() => {});
  }
}
