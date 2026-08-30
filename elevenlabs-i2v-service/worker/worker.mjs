#!/usr/bin/env node
/**
 * worker.mjs — the local "render farm" for the hosted video service.
 *
 * Runs on YOUR laptop. Polls the Vercel app for the next queued job, generates the
 * video by driving your logged-in Chrome (see lib/generate-core.mjs), uploads the MP4
 * to Vercel Blob, and reports the result back. Pull-based: no inbound ports.
 *
 * Requires (in worker/.env or the shell env):
 *   SERVICE_URL            https://your-app.vercel.app
 *   WORKER_SECRET          shared secret (also set in Vercel) authorizing claim/complete
 *   BLOB_READ_WRITE_TOKEN  Vercel Blob token (so the worker can upload MP4s directly)
 *   CDP_URL                default http://localhost:9222
 *   POLL_MS                default 4000 (how often to ask for work when idle)
 *
 * First: launch Chrome with --remote-debugging-port=9222 on your normal profile and
 * be logged into elevenlabs.io  (see ../README.md). Then:  node worker.mjs
 */
import 'dotenv/config';
import { connectChrome, generateVideo } from './lib/generate-core.mjs';

const SERVICE_URL = (process.env.SERVICE_URL || '').replace(/\/$/, '');
const WORKER_SECRET = process.env.WORKER_SECRET;
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const POLL_MS = Number(process.env.POLL_MS || 4000);

if (!SERVICE_URL) fail('SERVICE_URL is required');
if (!WORKER_SECRET) fail('WORKER_SECRET is required');

function fail(m) { console.error('✗', m); process.exit(1); }
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, body) {
  const r = await fetch(`${SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': WORKER_SECRET },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  log('connecting to Chrome at', CDP_URL, '…');
  // A transient CDP websocket blip must not kill a 5-minute render worker, so
  // the connection is (re)established lazily and re-established on loss instead
  // of exiting. attached tracks liveness via the browser 'disconnected' event.
  let browser = null;
  let page = null;
  let attached = false;

  async function ensureConnection() {
    if (attached && browser && browser.isConnected && browser.isConnected()) return;
    attached = false;
    for (let tries = 0; tries < 30; tries++) {
      try {
        ({ browser, page } = await connectChrome(CDP_URL));
        const okLogin = await page
          .evaluate(() => !!Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser:')))
          .catch(() => false);
        if (!okLogin) throw new Error('Chrome is not logged into elevenlabs.io');
        attached = true;
        browser.on('disconnected', () => {
          attached = false;
          log('… CDP connection dropped; will reconnect on the next job.');
        });
        return;
      } catch (e) {
        log('connect attempt failed:', e.message, '— retrying in 5s');
        await sleep(5000);
      }
    }
    fail('could not attach to a logged-in Chrome after many tries. Relaunch Chrome (--remote-debugging-port=9222) and this worker.');
  }

  log('connecting to Chrome at', CDP_URL, '…');
  await ensureConnection();
  log('worker online. polling', SERVICE_URL, 'every', POLL_MS + 'ms');

  // Main loop.
  for (;;) {
    let job;
    try { ({ job } = await api('/api/worker/claim')); }
    catch (e) { log('claim error:', e.message); await sleep(POLL_MS * 2); continue; }

    if (!job) { await sleep(POLL_MS); continue; }

    log(`▶ job ${job.id} — "${(job.prompt || '').slice(0, 60)}"`);
    try {
      await ensureConnection(); // reconnect if a prior job's render dropped CDP

      // Pull the visitor's uploaded start frame.
      const imgRes = await fetch(job.inputUrl);
      if (!imgRes.ok) throw new Error('could not fetch input image');
      const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = imgRes.headers.get('content-type') || 'image/png';
      const ext = (mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg');

      const { id, bytes } = await generateVideo(page, {
        imageBuffer,
        imageName: `start.${ext}`,
        mimeType,
        prompt: job.prompt,
        duration: job.duration,
        aspect: job.aspect,
        resolution: job.resolution,
        audio: job.audio,
        onStatus: (s) => log(`  … ${s}`),
      });

      // Upload the MP4 through the service (Blob token stays on Vercel).
      const up = await fetch(
        `${SERVICE_URL}/api/worker/upload?name=videos/${job.id}.mp4`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'video/mp4', 'x-worker-secret': WORKER_SECRET },
          body: bytes,
        }
      );
      if (!up.ok) throw new Error(`upload → HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
      const { url: outputUrl } = await up.json();
      await api('/api/worker/complete', { id: job.id, outputUrl, generationId: id });
      log(`✓ job ${job.id} done — ${(bytes.length / 1e6).toFixed(1)}MB`);
    } catch (e) {
      log(`✗ job ${job.id} failed:`, e.message);
      try { await api('/api/worker/complete', { id: job.id, error: e.message.slice(0, 300) }); }
      catch (e2) { log('  (could not report failure):', e2.message); }
    }
  }
}

main().catch((e) => fail(e.stack || e.message));
