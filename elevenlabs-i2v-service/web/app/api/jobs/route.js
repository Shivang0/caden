import { put } from '@vercel/blob';
import {
  initSchema, intakeOpen, capacityCheck, createJob, visitorId, LIMITS,
} from '../../../lib/db.js';
import { moderatePrompt, validImageType } from '../../../lib/moderation.js';

export const runtime = 'nodejs';

// POST /api/jobs  — multipart: { image: File, prompt: string }  → { id }
export async function POST(req) {
  try {
    await initSchema();

    if (!(await intakeOpen()))
      return json({ error: 'Intake is paused right now.' }, 503);

    const form = await req.formData();
    const prompt = (form.get('prompt') || '').toString();
    const image = form.get('image');

    const modErr = moderatePrompt(prompt);
    if (modErr) return json({ error: modErr }, 400);

    if (!image || typeof image === 'string')
      return json({ error: 'An image is required.' }, 400);
    if (!validImageType(image.type))
      return json({ error: 'Image must be jpg, png, webp, or heic.' }, 400);
    if (image.size > LIMITS.maxImageBytes)
      return json({ error: 'Image is too large (max 4 MB).' }, 400);

    const visitor = visitorId(req);
    const capErr = await capacityCheck(visitor);
    if (capErr) return json({ error: capErr }, 429);

    // Upload the start frame to Blob.
    const ext = (image.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const bytes = Buffer.from(await image.arrayBuffer());
    const blob = await put(`inputs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, bytes, {
      access: 'public',
      contentType: image.type,
    });

    const id = await createJob({ prompt: prompt.trim(), inputUrl: blob.url, visitor });
    return json({ id });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || 'unknown') }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
