// caden voice: turn a generated artifact into audio via ElevenLabs TTS.
// POST { text } -> audio/mpeg bytes.

export const config = {
  maxDuration: 120,
};

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  try {
    if (!(process.env.ELEVEN_KEY_V2 || process.env.ELEVENLABS_API_KEY)) {
      res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured on the server." });
      return;
    }

    const text = ((req.body && req.body.text) || "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required." });
      return;
    }

    const requested = ((req.body && req.body.voiceId) || "").trim();
    const voiceId = /^[A-Za-z0-9]{8,40}$/.test(requested)
      ? requested
      : process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
    // Keep credit spend bounded: read the first ~2500 chars of the artifact.
    const clipped = text.slice(0, 2500);

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": (process.env.ELEVEN_KEY_V2 || process.env.ELEVENLABS_API_KEY),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: clipped,
          model_id: "eleven_multilingual_v2",
          // casual mode (UGC scripts): lower stability + style so the read
          // sounds like a person talking to their phone, not a narrator.
          voice_settings: (req.body && req.body.casual)
            ? { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true }
            : { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!r.ok) {
      const body = await r.text();
      const msg =
        r.status === 401
          ? "ElevenLabs API key rejected. Check ELEVENLABS_API_KEY."
          : `ElevenLabs error ${r.status}: ${body.slice(0, 200)}`;
      res.status(502).json({ error: msg });
      return;
    }

    const audio = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length,
      "Cache-Control": "no-store",
    });
    res.end(audio);
  } catch (err) {
    res.status(500).json({ error: err.message || "Voice generation failed." });
  }
}
