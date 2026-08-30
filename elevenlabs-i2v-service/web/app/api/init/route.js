import { initSchema } from '../../../lib/db.js';

export const runtime = 'nodejs';

// POST /api/init  (x-worker-secret) — create tables once after provisioning Postgres.
export async function POST(req) {
  if (req.headers.get('x-worker-secret') !== process.env.WORKER_SECRET)
    return json({ error: 'unauthorized' }, 401);
  try {
    await initSchema();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
