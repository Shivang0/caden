// POST /api/audio — text-to-speech narration via ElevenLabs.
// Streams the MP3 bytes straight through. Without an API key this returns
// 501 {error:"no_key"} so the client can fall back (e.g. Web Speech API).

import { z } from "zod";

export const maxDuration = 120;

const MAX_TEXT_LENGTH = 5000;
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

const bodySchema = z.object({
  text: z.string().min(1, "text is required"),
});

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "no_key" }, { status: 501 });
  }

  const text = parsed.data.text.slice(0, MAX_TEXT_LENGTH);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    // /stream starts sending MP3 frames as they are synthesized — first audio
    // reaches the client in ~1s instead of after full synthesis.
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      let detail = `ElevenLabs returned ${upstream.status}`;
      try {
        const errBody = (await upstream.json()) as { detail?: { message?: string } | string };
        if (typeof errBody.detail === "string") detail = errBody.detail;
        else if (errBody.detail?.message) detail = errBody.detail.message;
      } catch {
        // keep the status-based message
      }
      return Response.json({ error: detail }, { status: 502 });
    }

    // Pass the audio bytes through without buffering.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[cadence] /api/audio failed:", error);
    return Response.json({ error: "Failed to reach the text-to-speech service." }, { status: 500 });
  }
}
