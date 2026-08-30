import { claimNext } from '../../../../lib/db.js';

export const runtime = 'nodejs';

// POST /api/worker/claim  (x-worker-secret) → { job: {id,prompt,inputUrl} | null }
export async function POST(req) {
  if (req.headers.get('x-worker-secret') !== process.env.WORKER_SECRET)
    return json({ error: 'unauthorized' }, 401);
  try {
    const job = await claimNext();
    return json({ job });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
