// POST /api/transcribe — forwards a recorded audio blob to Aqua Voice for
// speech-to-text. Keyless mode: 501 {error:"no_key"}; key-present upstream
// failures: 502 {error:"upstream"}. Either way the client falls back to
// browser SpeechRecognition, but the payloads (and server logs) distinguish
// "no key configured" from "key set but upstream misconfigured/down".

// TODO: confirm exact Aqua Voice REST path once their public HTTP docs settle.
// Isolated here so it is a one-line fix.
const AQUA_TRANSCRIBE_URL = "https://api.withaqua.com/v1/transcribe";

const NO_KEY = () => Response.json({ error: "no_key" }, { status: 501 });
const UPSTREAM_FAILED = () =>
  Response.json({ error: "upstream" }, { status: 502 });

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.AQUA_API_KEY;
  if (!apiKey) return NO_KEY();

  let audio: Blob;
  try {
    const form = await request.formData();
    const field = form.get("audio");
    if (!(field instanceof Blob) || field.size === 0) {
      return Response.json({ error: "missing_audio" }, { status: 400 });
    }
    audio = field;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const upstreamForm = new FormData();
    upstreamForm.append(
      "file",
      audio,
      audio.type.includes("mp4") ? "note.mp4" : "note.webm",
    );

    const upstream = await fetch(AQUA_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      console.error(
        `[cadence] /api/transcribe upstream returned ${upstream.status}: ${body.slice(0, 500)}`,
      );
      return UPSTREAM_FAILED();
    }

    const data = (await upstream.json()) as {
      text?: unknown;
      transcript?: unknown;
    };
    const text =
      typeof data.text === "string"
        ? data.text
        : typeof data.transcript === "string"
          ? data.transcript
          : "";

    if (!text.trim()) {
      console.error(
        "[cadence] /api/transcribe upstream responded OK but without a transcript field.",
      );
      return UPSTREAM_FAILED();
    }
    return Response.json({ text });
  } catch (error) {
    // Network error, timeout, bad JSON — never crash, let the client fall back.
    console.error("[cadence] /api/transcribe upstream request failed:", error);
    return UPSTREAM_FAILED();
  }
}
