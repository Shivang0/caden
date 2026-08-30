import { setIntake, intakeOpen } from '../../../../lib/db.js';

export const runtime = 'nodejs';

// POST /api/admin/intake  (x-worker-secret)  body: { open: boolean }  — the kill switch.
export async function POST(req) {
  if (req.headers.get('x-worker-secret') !== process.env.WORKER_SECRET)
    return json({ error: 'unauthorized' }, 401);
  try {
    const { open } = await req.json();
    await setIntake(!!open);
    return json({ intake_open: await intakeOpen() });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
