// caden i2v bridge: the founder's photo goes to the elevenlabs-i2v renderer
// (no CORS on that service, so the browser talks to us and we proxy), then the
// finished clip gets the founder's cloned voiceover muxed in with ffmpeg.
//
//   POST {image_b64, mime, image_urls, prompt}   -> {id}          (submit job)
//   GET  ?id=...                                 -> {status, position, outputUrl}
//   POST {mux: true, video_url, audio_b64}       -> video/mp4     (voice layover)

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const config = {
  maxDuration: 300,
};

const I2V_BASE = "https://elevenlabs-i2v.vercel.app";

async function imageBufferFrom(body) {
  if (body.image_b64) {
    return {
      buf: Buffer.from(body.image_b64, "base64"),
      mime: (body.mime || "image/jpeg").slice(0, 40),
    };
  }
  for (const url of (body.image_urls || []).slice(0, 6)) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) continue;
      const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
      if (!mime.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 3000) return { buf, mime };
    } catch (e) {
      // try the next candidate
    }
  }
  throw new Error("No usable photo. Upload one and retry.");
}

async function submitJob(req, res) {
  const body = req.body || {};
  const prompt = (body.prompt || "").trim().slice(0, 500);
  if (!prompt) {
    res.status(400).json({ error: "prompt is required." });
    return;
  }
  const { buf, mime } = await imageBufferFrom(body);
  if (buf.length > 4 * 1024 * 1024) {
    res.status(400).json({ error: "Image over 4 MB. Use a smaller photo." });
    return;
  }

  const form = new FormData();
  form.append("image", new Blob([buf], { type: mime }), mime.includes("png") ? "frame.png" : "frame.jpg");
  form.append("prompt", prompt);

  const r = await fetch(`${I2V_BASE}/api/jobs`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.id) {
    res.status(502).json({ error: data.error || `i2v submit failed (${r.status}).` });
    return;
  }
  res.status(200).json({ id: data.id, status: data.status || "queued", position: data.position ?? null });
}

async function pollJob(req, res) {
  const id = String(req.query.id || "").slice(0, 80);
  if (!/^[\w-]+$/.test(id)) {
    res.status(400).json({ error: "bad id" });
    return;
  }
  const r = await fetch(`${I2V_BASE}/api/jobs/${id}`, { signal: AbortSignal.timeout(15000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    res.status(502).json({ error: data.error || `poll failed (${r.status})` });
    return;
  }
  res.status(200).json({
    status: data.status || "unknown",
    position: data.position ?? null,
    outputUrl: data.outputUrl || null,
    error: data.error || null,
  });
}

async function muxVoice(req, res) {
  const { video_url: videoUrl, audio_b64: audioB64 } = req.body || {};
  if (!videoUrl || !audioB64) {
    res.status(400).json({ error: "video_url and audio_b64 are required." });
    return;
  }
  // Only pull clips from the i2v service or its storage.
  let host;
  try {
    host = new URL(videoUrl).hostname;
  } catch (e) {
    res.status(400).json({ error: "bad video_url" });
    return;
  }
  if (!/vercel\.app$|vercel-storage\.com$|\bblob\.core\.windows\.net$|amazonaws\.com$/.test(host)) {
    res.status(400).json({ error: "video_url host not allowed" });
    return;
  }

  const stamp = Date.now().toString(36);
  const vidPath = join(tmpdir(), `i2v-${stamp}.mp4`);
  const audPath = join(tmpdir(), `i2v-${stamp}.mp3`);
  const outPath = join(tmpdir(), `i2v-${stamp}-final.mp4`);
  try {
    const clip = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
    if (!clip.ok) throw new Error(`Could not download the clip (${clip.status}).`);
    await writeFile(vidPath, Buffer.from(await clip.arrayBuffer()));
    await writeFile(audPath, Buffer.from(audioB64, "base64"));

    // Loop the clip under the voiceover; the voice track sets the length.
    await execFileAsync(
      ffmpegPath,
      [
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
      ],
      { timeout: 120000 }
    );
    const finalVideo = await readFile(outPath);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": finalVideo.length,
      "Cache-Control": "no-store",
    });
    res.end(finalVideo);
  } finally {
    await Promise.all([
      rm(vidPath, { force: true }),
      rm(audPath, { force: true }),
      rm(outPath, { force: true }),
    ]).catch(() => {});
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return await pollJob(req, res);
    if (req.method === "POST" && req.body && req.body.mux) return await muxVoice(req, res);
    if (req.method === "POST") return await submitJob(req, res);
    res.status(405).json({ error: "GET or POST only" });
  } catch (err) {
    res.status(502).json({ error: err.message || "i2v bridge failed." });
  }
}
