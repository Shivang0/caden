// Minimal prompt moderation. ElevenLabs also moderates server-side (a rejected
// generation comes back as `moderated` → the worker marks the job failed), but this
// keeps obvious abuse off your account before it spends a credit. Tune for your event.
const BLOCKED = [
  /\bnsfw\b/i, /\bnude|naked\b/i, /\bporn/i, /\bgore\b/i, /\bbestiality\b/i,
  /\bchild\b.*\b(sexual|explicit)/i, /\bcsam\b/i,
  /\b(real|photo)\s+of\s+(a\s+)?(politician|president|celebrity)/i, // discourage deepfakes of real people
];

export function moderatePrompt(prompt) {
  const p = (prompt || '').trim();
  if (!p) return 'Prompt is required.';
  if (p.length > 500) return 'Prompt is too long (max 500 chars).';
  for (const re of BLOCKED) if (re.test(p)) return 'That prompt is not allowed for this demo.';
  return null;
}

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export function validImageType(mime) {
  return ALLOWED_IMAGE.has((mime || '').toLowerCase());
}
