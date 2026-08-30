import { getJob } from '../../../../lib/db.js';

export const runtime = 'nodejs';

// GET /api/jobs/:id → { status, position, outputUrl, error }
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) return json({ error: 'not found' }, 404);
    return json({
      id: job.id,
      status: job.status,
      position: job.position,
      prompt: job.prompt,
      inputUrl: job.input_url,
      outputUrl: job.output_url,
      error: job.error,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
