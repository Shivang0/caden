// POST /api/voice/clone — clone the signed-in founder's voice from a recorded
// sample and pin the resulting ElevenLabs voice id to their profile. Every
// video we generate afterwards speaks in this voice automatically.
// GET returns whether a voice is pinned. The audio is forwarded to ElevenLabs
// and never stored by us; founders should only ever record their own voice.

import { getSession } from "@/lib/auth";
import { findUserById, setVoiceId } from "@/lib/users";

export const runtime = "nodejs";
export const maxDuration = 120;

function elevenKey(): string {
  return process.env.ELEVEN_KEY_V2 || process.env.ELEVENLABS_API_KEY || "";
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });
  const doc = await findUserById(user.id);
  return Response.json({ voiceReady: Boolean(doc?.voiceId), voiceId: doc?.voiceId ?? null });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });
  if (!elevenKey()) {
    return Response.json({ error: "Voice cloning is not configured on the server." }, { status: 501 });
  }

  let audioB64 = "";
  let mime = "audio/webm";
  try {
    const body = (await request.json()) as { audio_b64?: string; mime?: string };
    audioB64 = (body.audio_b64 ?? "").trim();
    if (body.mime) mime = body.mime.slice(0, 40);
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!audioB64) return Response.json({ error: "audio_b64 is required." }, { status: 400 });

  const audio = Buffer.from(audioB64, "base64");
  if (audio.length < 20_000) {
    return Response.json(
      { error: "Sample too short. Read the whole script, about 20 seconds." },
      { status: 400 }
    );
  }

  const form = new FormData();
  form.append("name", `caden ${user.name || user.email} ${Date.now().toString(36)}`.slice(0, 80));
  form.append(
    "files",
    new Blob([new Uint8Array(audio)], { type: mime }),
    mime.includes("mp3") || mime.includes("mpeg") ? "sample.mp3" : "sample.webm"
  );
  form.append("remove_background_noise", "true");

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": elevenKey() },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 160);
    const message =
      res.status === 401
        ? "ElevenLabs key rejected."
        : `Voice clone failed (${res.status}): ${detail}`;
    return Response.json({ error: message }, { status: 502 });
  }

  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) return Response.json({ error: "ElevenLabs returned no voice id." }, { status: 502 });

  await setVoiceId(user.id, data.voice_id);
  return Response.json({ ok: true, voiceId: data.voice_id });
}
