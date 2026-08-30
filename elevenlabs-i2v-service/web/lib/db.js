// Job queue store on MongoDB Atlas (MONGODB_URI). Replaces the original
// @vercel/postgres version: Vercel Postgres is gone from the platform, the
// hackathon already has an Atlas cluster, and one connection string beats a
// marketplace signup at 1am. Exported signatures and returned field names are
// unchanged, so the API routes did not have to move.

import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'node:crypto';

// Cache the connect PROMISE (not the client): a failed or dropped connection
// resets the cache instead of serving a dead topology on the next invocation.
let clientPromise = null;

async function db() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!clientPromise) {
    const c = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    clientPromise = c.connect().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  const connected = await clientPromise;
  return connected.db(process.env.MONGODB_DB || 'i2v');
}

const jobs = async () => (await db()).collection('jobs');
const settings = async () => (await db()).collection('settings');

// ---- schema (idempotent) ---------------------------------------------------
export async function initSchema() {
  const col = await jobs();
  await col.createIndex({ status: 1, created_at: 1 });
  const s = await settings();
  await s.updateOne({ _id: 1 }, { $setOnInsert: { intake_open: true } }, { upsert: true });
}

// ---- limits (env-tunable) --------------------------------------------------
export const LIMITS = {
  globalDailyCap: Number(process.env.GLOBAL_DAILY_CAP || 40),   // protect the ~50 credits
  perVisitorHourly: Number(process.env.PER_VISITOR_HOURLY || 3),
  maxQueue: Number(process.env.MAX_QUEUE || 15),
  maxPromptLen: 500,
  maxImageBytes: 4 * 1024 * 1024,
};

export function visitorId(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const salt = process.env.VISITOR_SALT || 'demo-salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex').slice(0, 16);
}

export async function intakeOpen() {
  const s = await settings();
  const row = await s.findOne({ _id: 1 });
  return row?.intake_open ?? true;
}
export async function setIntake(open) {
  const s = await settings();
  await s.updateOne({ _id: 1 }, { $set: { intake_open: open } }, { upsert: true });
}

// ---- capacity checks -------------------------------------------------------
export async function capacityCheck(visitor) {
  const col = await jobs();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const [g, v, q] = await Promise.all([
    col.countDocuments({ created_at: { $gt: dayAgo } }),
    col.countDocuments({ visitor, created_at: { $gt: hourAgo } }),
    col.countDocuments({ status: { $in: ['queued', 'processing'] } }),
  ]);
  if (g >= LIMITS.globalDailyCap) return 'Daily demo limit reached — check back tomorrow.';
  if (v >= LIMITS.perVisitorHourly) return 'You have hit the per-visitor limit for this hour.';
  if (q >= LIMITS.maxQueue) return 'The queue is full right now — try again in a bit.';
  return null;
}

// ---- job ops ---------------------------------------------------------------
export async function createJob({ prompt, inputUrl, visitor }) {
  const col = await jobs();
  const { insertedId } = await col.insertOne({
    status: 'queued',
    prompt,
    input_url: inputUrl,
    output_url: null,
    generation_id: null,
    error: null,
    visitor,
    created_at: new Date(),
    started_at: null,
    finished_at: null,
  });
  return insertedId.toString();
}

export async function getJob(id) {
  if (!ObjectId.isValid(id)) return null;
  const col = await jobs();
  const job = await col.findOne({ _id: new ObjectId(id) });
  if (!job) return null;
  let position = 0;
  if (job.status === 'queued') {
    position = (await col.countDocuments({ status: 'queued', created_at: { $lt: job.created_at } })) + 1;
  }
  return { ...job, id: job._id.toString(), position };
}

// Atomically claim the oldest queued job for the single worker.
export async function claimNext() {
  const col = await jobs();
  const j = await col.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'processing', started_at: new Date() } },
    { sort: { created_at: 1 }, returnDocument: 'after' }
  );
  return j ? { id: j._id.toString(), prompt: j.prompt, inputUrl: j.input_url } : null;
}

export async function completeJob(id, { outputUrl, generationId, error }) {
  if (!ObjectId.isValid(id)) return;
  const col = await jobs();
  if (error) {
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'failed', error, finished_at: new Date() } }
    );
  } else {
    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'done',
          output_url: outputUrl,
          generation_id: generationId || null,
          finished_at: new Date(),
        },
      }
    );
  }
}
