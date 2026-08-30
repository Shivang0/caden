/**
 * generate-core — the reusable ElevenLabs image-to-video automation.
 *
 * Same recipe proven in ../../elevenlabs-i2v: attach to a real, logged-in Chrome
 * over CDP so the page mints hCaptcha itself, drive the composer UI to CREATE,
 * then poll + download with the app's own live Firebase token (never copied out).
 *
 * Exposed for the worker so it can turn one queued job into one MP4.
 */
import { chromium } from 'playwright-core';

const API = 'https://api.us.elevenlabs.io/v1/content/generations';
const COMPOSER_URL = 'https://elevenlabs.io/app/image-video?modality=video';

export async function connectChrome(cdp = 'http://localhost:9222') {
  // Chrome 152 rejects playwright's browser-level setup when it discovers the
  // endpoint from the HTTP base ("Browser context management is not supported").
  // Resolving the browser websocket URL from /json/version and connecting to it
  // directly avoids that path. Falls back to the raw value if resolution fails.
  let endpoint = cdp;
  if (/^https?:\/\//.test(cdp)) {
    try {
      const base = cdp.replace(/\/+$/, '');
      const res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(8000) });
      const info = await res.json();
      if (info.webSocketDebuggerUrl) endpoint = info.webSocketDebuggerUrl;
    } catch {
      // keep the original endpoint; connectOverCDP will surface any error
    }
  }
  const browser = await chromium.connectOverCDP(endpoint);
  const contexts = browser.contexts();
  const context = contexts.find((c) => c.pages().length) || contexts[0];
  if (!context) throw new Error('No browser context in the attached Chrome.');
  let page = context.pages().find((p) => p.url().includes('elevenlabs.io'));
  if (!page) page = await context.newPage();
  return { browser, page };
}

async function listGenerations(page, pageSize = 8) {
  return page.evaluate(async ({ api, pageSize }) => {
    const fbKey = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser:'));
    if (!fbKey) throw new Error('Not logged into ElevenLabs (no firebase auth).');
    const token = JSON.parse(localStorage.getItem(fbKey)).stsTokenManager.accessToken;
    const r = await fetch(`${api}?page_size=${pageSize}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) throw new Error('list failed: HTTP ' + r.status);
    const j = await r.json();
    return (j.generations || j.items || j.data || []).map((g) => ({
      id: g.generation_id || g.id,
      status: g.status,
      download_url:
        g.download_url || g.content_url || g.content_capped_resolution_url || null,
    }));
  }, { api: API, pageSize });
}

/**
 * Generate one video. Returns { id, bytes } where bytes is a Node Buffer of the MP4.
 * @param {import('playwright-core').Page} page
 * @param {{imageBuffer: Buffer, imageName: string, mimeType?: string, prompt: string,
 *          duration?: string, aspect?: string, resolution?: string, audio?: boolean,
 *          timeoutSec?: number, onStatus?: (s:string)=>void}} job
 */
export async function generateVideo(page, job) {
  const {
    imageBuffer, imageName = 'start.png', mimeType = 'image/png', prompt,
    duration, aspect, resolution, audio = false, timeoutSec = 600, onStatus = () => {},
  } = job;
  if (!imageBuffer) throw new Error('imageBuffer required');
  if (!prompt) throw new Error('prompt required');

  onStatus('opening composer');
  // 'commit' resolves as soon as the navigation commits (the heavy SPA can take
  // far longer than 30s to fire domcontentloaded on a busy browser); the
  // waitForSelector below is the real readiness gate. Skip the nav entirely if
  // we are already sitting on the composer.
  if (!page.url().includes('/app/image-video')) {
    await page.goto(COMPOSER_URL, { waitUntil: 'commit', timeout: 60000 });
  }

  const loggedIn = await page.evaluate(
    () => !!Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser:'))
  );
  if (!loggedIn) throw new Error('Chrome is not logged into ElevenLabs.');

  await page.waitForSelector('.tiptap.ProseMirror', { timeout: 30000 });
  try {
    const videoTab = page.getByRole('button', { name: /^Video$/ }).first();
    if (await videoTab.isVisible()) await videoTab.click({ timeout: 2000 }).catch(() => {});
  } catch {}

  const before = new Set((await listGenerations(page)).map((g) => g.id));

  // Attach start frame via the native file chooser (Playwright accepts an in-memory file).
  onStatus('attaching start frame');
  const fileArg = { name: imageName, mimeType, buffer: imageBuffer };
  let attached = false;
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.getByText('Start frame', { exact: false }).first().click({ timeout: 4000 }),
    ]);
    await chooser.setFiles(fileArg);
    attached = true;
  } catch {
    const inputs = page.locator('input[type=file]');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const accept = (await inputs.nth(i).getAttribute('accept')) || '';
      if (accept.includes('image') && !accept.includes('font')) {
        await inputs.nth(i).setInputFiles(fileArg);
        attached = true;
        break;
      }
    }
  }
  if (!attached) throw new Error('Could not attach the start-frame image.');
  await page.waitForTimeout(2500);

  // Optional settings (best-effort).
  async function pickMenu(triggerRe, optionText) {
    try {
      await page.getByRole('button', { name: triggerRe }).first().click({ timeout: 2000 });
      await page.getByRole('menuitem', { name: new RegExp(optionText, 'i') }).first().click({ timeout: 2000 });
    } catch {}
  }
  if (duration) await pickMenu(/Duration/i, `${duration}\\s*s`);
  if (aspect) await pickMenu(/Aspect|Ratio/i, aspect.replace(':', '\\s*:\\s*'));
  if (resolution) await pickMenu(/Resolution|Quality/i, resolution);

  // Type the prompt. pressSequentially (char-by-char with an actionability
  // check per key) times out on longer prompts / a momentarily-busy editor, so
  // focus the editor and insert the whole string at once via CDP, with the
  // slow path only as a fallback.
  onStatus('typing prompt');
  const editor = page.locator('#image-video-prompt-box, .tiptap.ProseMirror').first();
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  await editor.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  let typed = false;
  try {
    await editor.evaluate((el) => el.focus());
    await page.keyboard.insertText(prompt); // one CDP Input.insertText, no per-char wait
    typed = true;
  } catch {
    // fall through to the slow, char-by-char path
  }
  // Verify the text actually landed; if not, retry the slow way.
  const landed = await editor.evaluate((el) => (el.textContent || '').trim().length > 0).catch(() => false);
  if (!typed || !landed) {
    await editor.click({ timeout: 10000 }).catch(() => {});
    await editor.pressSequentially(prompt, { delay: 6, timeout: 90000 });
  }

  // Create — the page runs hCaptcha here.
  onStatus('submitting (hCaptcha runs)');
  const genBtn = page.locator('button[aria-label="Generate"]').first();
  await genBtn.waitFor({ state: 'visible', timeout: 10000 });
  await genBtn.click();

  // If a *visible* challenge appears, we cannot proceed unattended.
  await page.waitForTimeout(1500);
  const challenge = page.locator('iframe[title*="hCaptcha challenge" i]');
  if ((await challenge.count().catch(() => 0)) && (await challenge.first().isVisible().catch(() => false))) {
    onStatus('BLOCKED: visible hCaptcha — needs a human at the laptop');
    await challenge.first().waitFor({ state: 'hidden', timeout: 180000 })
      .catch(() => { throw new Error('hCaptcha challenge not solved in time.'); });
  }

  // Poll for the new generation.
  onStatus('rendering');
  const deadline = Date.now() + timeoutSec * 1000;
  let done = null;
  while (Date.now() < deadline) {
    let list;
    try { list = await listGenerations(page); } catch { await page.waitForTimeout(3000); continue; }
    const target = list.find((g) => g.id && !before.has(g.id));
    if (target) {
      if (target.status === 'completed') { done = target; break; }
      if (target.status === 'failed' || target.status === 'moderated')
        throw new Error(`generation ${target.status}`);
      onStatus(`rendering (${target.status || 'pending'})`);
    }
    await page.waitForTimeout(4000);
  }
  if (!done) throw new Error('timed out waiting for render');
  if (!done.download_url) throw new Error('completed but no download_url');

  // Download the MP4 bytes (try Node fetch, fall back to in-page fetch).
  onStatus('downloading');
  try {
    const r = await fetch(done.download_url);
    if (r.ok) return { id: done.id, bytes: Buffer.from(await r.arrayBuffer()) };
  } catch {}
  const b64 = await page.evaluate(async (url) => {
    const r = await fetch(url);
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }, done.download_url);
  return { id: done.id, bytes: Buffer.from(b64, 'base64') };
}
