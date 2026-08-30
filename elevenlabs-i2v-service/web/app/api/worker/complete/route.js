import { completeJob } from '../../../../lib/db.js';

export const runtime = 'nodejs';

// POST /api/worker/complete  (x-worker-secret)
//   body: { id, outputUrl, generationId }  OR  { id, error }
export async function POST(req) {
  if (req.headers.get('x-worker-secret') !== process.env.WORKER_SECRET)
    return json({ error: 'unauthorized' }, 401);
  try {
    const { id, outputUrl, generationId, error } = await req.json();
    if (!id) return json({ error: 'id required' }, 400);
    await completeJob(id, { outputUrl, generationId, error });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
