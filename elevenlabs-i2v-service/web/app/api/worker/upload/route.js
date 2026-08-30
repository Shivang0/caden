import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/worker/upload?name=videos/<id>.mp4  (x-worker-secret, raw body)
// → { url }
// The worker streams the finished MP4 here instead of holding a Blob token on
// the laptop; only the deployment ever touches BLOB_READ_WRITE_TOKEN.
export async function POST(req) {
  if (req.headers.get('x-worker-secret') !== process.env.WORKER_SECRET)
    return json({ error: 'unauthorized' }, 401);
  try {
    const name = (new URL(req.url).searchParams.get('name') || '').replace(/[^\w./-]/g, '');
    if (!/^videos\/[\w-]+\.mp4$/.test(name)) return json({ error: 'bad name' }, 400);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length < 1000) return json({ error: 'empty body' }, 400);
    if (bytes.length > 100 * 1024 * 1024) return json({ error: 'too large' }, 413);
    const blob = await put(name, bytes, { access: 'public', contentType: 'video/mp4' });
    return json({ url: blob.url });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
