// caden scene director: turn the update post into a UGC-style video direction.
// POST { text, founder } -> { prompt, script }
//   prompt: image-to-video direction, phone-shot founder vlog, NOT cinematic
//   script: what the founder says to camera, casual first person, 20-30s
// One fast non-streaming call; either field degrades independently.

export const config = {
  maxDuration: 60,
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODELS = ["moonshotai/kimi-k3", "nvidia/nemotron-3-super-120b-a12b"];

// The anti-slop fallback: looks like a founder holding their phone, not a
// perfume ad. Genuine review feedback: cinematic output reads as AI, handheld
// imperfection reads as real.
const FALLBACK_SCENE =
  "Handheld selfie video shot on a phone front camera, slightly off-center framing. " +
  "The person talks straight to camera with natural energy, blinking, small head tilts, " +
  "one hand gesturing now and then. Behind them a real workspace: desk, laptop, a mug, " +
  "cables, soft daylight from a window to one side. Subtle handheld wobble, ordinary " +
  "phone-camera exposure, mild grain. It looks like a founder recording a quick vlog " +
  "story, not a commercial. No readable text, no logos, no studio lighting, no color grading.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const text = ((req.body && req.body.text) || "").trim().slice(0, 4000);
  if (!text || !process.env.NVIDIA_API_KEY) {
    res.status(200).json({ prompt: FALLBACK_SCENE, script: "", via: "fallback" });
    return;
  }

  try {
    const SYSTEM =
      "You direct 20 to 30 second founder update videos that look like real UGC, the kind a founder " +
      "films on their phone in one take. You are given the founder's product update. Respond with ONLY " +
      'a JSON object: {"scene": str, "script": str}.\n' +
      "scene: at most 80 words for an image-to-video model whose first frame is a photo of the founder. " +
      "Describe a handheld phone selfie video: the person talking to camera, natural blinks and head " +
      "movement, occasional hand gesture, a real lived-in workspace behind them, window daylight, slight " +
      "handheld wobble, ordinary phone exposure with mild grain. Explicitly NOT cinematic: no studio " +
      "lighting, no color grading, no slow camera moves, no readable text or logos.\n" +
      "script: 45 to 70 words the founder says to camera, first person, casual, like a voice note to a " +
      "friend who invested. Open mid-thought (for example: okay quick one, or, so this week actually went " +
      "well). Contractions everywhere. Mention 2 or 3 concrete things from the update in plain words. One " +
      "small honest aside (tired, excited, surprised) makes it human. End with a short plain sign-off. " +
      "No hashtags, no marketing words (excited to announce, thrilled, game-changing, journey), no " +
      "numbers that are not in the update. Never use em dashes or en dashes anywhere.";
    let r = null;
    let used = "";
    for (const model of MODELS) {
      const reqBody = {
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        max_tokens: 600,
        temperature: 0.8,
        stream: false,
      };
      if (model.startsWith("moonshotai/")) reqBody.reasoning_effort = "low";
      if (model.startsWith("nvidia/")) reqBody.chat_template_kwargs = { thinking: false };
      r = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });
      used = model;
      if (r.status !== 429) break;
      await r.text().catch(() => {});
    }
    if (!r || !r.ok) throw new Error(`NVIDIA ${r ? r.status : "unreachable"}`);
    const data = await r.json();
    const raw = (((data.choices || [])[0] || {}).message || {}).content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no json");
    const parsed = JSON.parse(m[0]);
    const clean = (s) => String(s || "").replace(/[–—]/g, ",").replace(/\s+/g, " ").trim();
    const scene = clean(parsed.scene);
    const script = clean(parsed.script);
    if (scene.length < 40) throw new Error("scene too short");
    res.status(200).json({
      prompt: scene.slice(0, 900),
      script: script.slice(0, 700),
      via: used,
    });
  } catch (err) {
    res.status(200).json({ prompt: FALLBACK_SCENE, script: "", via: "fallback" });
  }
}
