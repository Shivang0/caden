// caden voice clone: create an ElevenLabs instant voice clone from the
// founder's own sample. POST { audio_b64, mime } -> { voiceId }
// The founder should only upload their own voice.

export const config = {
  maxDuration: 120,
};

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

  const audioB64 = ((req.body && req.body.audio_b64) || "").trim();
  const mime = ((req.body && req.body.mime) || "audio/webm").slice(0, 40);
  if (!audioB64) {
    res.status(400).json({ error: "audio_b64 is required." });
    return;
  }

  try {
    const audio = Buffer.from(audioB64, "base64");
    if (audio.length < 20000) {
      res.status(400).json({ error: "Sample too short. Record at least ten seconds." });
      return;
    }

    const form = new FormData();
    form.append("name", `caden founder ${Date.now().toString(36)}`);
    form.append(
      "files",
      new Blob([audio], { type: mime }),
      mime.includes("mp3") || mime.includes("mpeg") ? "sample.mp3" : "sample.webm"
    );
    form.append("remove_background_noise", "true");

    const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
    if (!r.ok) {
      const body = await r.text();
      const msg =
        r.status === 401
          ? "ElevenLabs key rejected."
          : `Voice clone failed (${r.status}): ${body.slice(0, 160)}`;
      res.status(502).json({ error: msg });
      return;
    }
    const data = await r.json();
    res.status(200).json({ voiceId: data.voice_id });
  } catch (err) {
    res.status(500).json({ error: err.message || "Voice clone failed." });
  }
}
