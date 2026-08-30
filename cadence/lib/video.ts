// Canvas renderer + timeline math for the caden video studio.
// Pure functions: safe to import from client components; no DOM globals
// touched at module scope.

import type { CadenceArtifacts, VideoScene } from "@/lib/types";

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const MIN_SCENE_SECONDS = 6;

export interface DrawSceneOptions {
  width: number;
  height: number;
  /** 0..1 progress within this scene */
  progress: number;
  sceneIndex: number;
  sceneCount: number;
  company: string;
}

/** clamp to [0,1] */
const c01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** ease-out cubic for entrances */
const easeOut = (t: number): number => 1 - Math.pow(1 - c01(t), 3);

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let consumed = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      consumed++;
    } else if (lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
      consumed++;
    } else {
      // Final line is full and words remain: truncate here.
      break;
    }
  }
  if (line) lines.push(line);
  // Ellipsize if we truncated, shrinking until the marker fits.
  if (consumed < words.length && lines.length > 0) {
    let last = `${lines[lines.length - 1].replace(/[.,;:]?$/, "")}…`;
    while (last.length > 2 && ctx.measureText(last).width > maxWidth) {
      last = `${last.slice(0, -2).trimEnd().replace(/[.,;:]?$/, "")}…`;
    }
    lines[lines.length - 1] = last;
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Draw a single scene frame. 1280x720 design space; scales to any width/height
 * with the same aspect via the opts dimensions.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: VideoScene,
  opts: DrawSceneOptions,
): void {
  const { width: w, height: h, sceneIndex, sceneCount, company } = opts;
  const progress = c01(opts.progress);
  const s = w / VIDEO_WIDTH; // uniform scale factor

  // ---- Background: caden near-black, barely-there diagonal shift ----
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#161616"); // bg-alt
  bg.addColorStop(0.55, "#181818");
  bg.addColorStop(1, "#1a1a1a"); // bg-main
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft yellow glow bottom-right for depth (rationed accent).
  const glow = ctx.createRadialGradient(
    w * 0.85,
    h * 0.9,
    0,
    w * 0.85,
    h * 0.9,
    w * 0.6,
  );
  glow.addColorStop(0, "rgba(249,254,46,0.05)"); // accent
  glow.addColorStop(1, "rgba(249,254,46,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Faint grid texture.
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  const grid = 80 * s;
  for (let x = grid; x < w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = grid; y < h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const marginX = 96 * s;
  const font = (px: number, weight = 400) =>
    `${weight} ${Math.round(px * s)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

  // ---- Company wordmark, top-left ----
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const markY = 64 * s;
  ctx.fillStyle = "#f9fe2e"; // accent
  ctx.beginPath();
  ctx.arc(marginX + 7 * s, markY, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = font(26, 600);
  ctx.fillStyle = "#f1f1f1"; // ink
  ctx.fillText(company, marginX + 26 * s, markY + 1 * s);
  const markW = ctx.measureText(company).width;
  ctx.font = font(26, 400);
  ctx.fillStyle = "#8f8f8f"; // ink-dim
  ctx.fillText("· shipped", marginX + 26 * s + markW + 12 * s, markY + 1 * s);

  // ---- Scene title: fades/slides in over first 18% of the scene ----
  const titleIn = easeOut(progress / 0.18);
  ctx.font = font(64, 800);
  const titleLines = wrapText(ctx, scene.title, w - marginX * 2, 2);
  const titleTop = 200 * s + (1 - titleIn) * 24 * s;
  ctx.globalAlpha = titleIn;
  ctx.textBaseline = "alphabetic";
  titleLines.forEach((line, i) => {
    // subtle vertical gradient on the type
    const yBase = titleTop + i * 78 * s;
    const tg = ctx.createLinearGradient(0, yBase - 60 * s, 0, yBase);
    tg.addColorStop(0, "#f1f1f1"); // ink
    tg.addColorStop(1, "#cfcfcf"); // body copy gray
    ctx.fillStyle = tg;
    ctx.fillText(line, marginX, yBase);
  });
  ctx.globalAlpha = 1;

  // Accent underline grows with the title.
  ctx.fillStyle = "#f9fe2e"; // accent
  roundRect(
    ctx,
    marginX,
    titleTop + (titleLines.length - 1) * 78 * s + 28 * s,
    140 * s * titleIn,
    6 * s,
    3 * s,
  );
  ctx.fill();

  // ---- Bullets: up to 3, staggered fade-in ----
  const bullets = scene.bullets.slice(0, 3);
  const bulletsTop =
    titleTop + (titleLines.length - 1) * 78 * s + 96 * s;
  bullets.forEach((bullet, i) => {
    const start = 0.22 + i * 0.16; // stagger
    const alpha = easeOut((progress - start) / 0.12);
    if (alpha <= 0) return;
    const y = bulletsTop + i * 76 * s;
    const slide = (1 - alpha) * 18 * s;
    ctx.globalAlpha = alpha;
    // marker
    ctx.fillStyle = "#f9fe2e";
    roundRect(ctx, marginX + slide, y - 8 * s, 16 * s, 16 * s, 5 * s);
    ctx.fill();
    // text
    ctx.font = font(32, 500);
    ctx.fillStyle = "#f1f1f1"; // ink
    ctx.textBaseline = "middle";
    const [line] = wrapText(ctx, bullet, w - marginX * 2 - 44 * s, 1);
    ctx.fillText(line ?? "", marginX + 40 * s + slide, y);
    ctx.globalAlpha = 1;
  });

  // ---- Bottom chrome: progress bar + scene counter ----
  const barY = h - 56 * s;
  const barW = w - marginX * 2;
  ctx.fillStyle = "rgba(255,255,255,0.09)"; // track
  roundRect(ctx, marginX, barY, barW, 8 * s, 4 * s);
  ctx.fill();
  const overall = c01((sceneIndex + progress) / Math.max(sceneCount, 1));
  if (overall > 0) {
    const fg = ctx.createLinearGradient(marginX, 0, marginX + barW, 0);
    fg.addColorStop(0, "#f9fe2e"); // accent
    fg.addColorStop(1, "#ffe042"); // accent-warm
    ctx.fillStyle = fg;
    roundRect(ctx, marginX, barY, Math.max(barW * overall, 8 * s), 8 * s, 4 * s);
    ctx.fill();
  }
  ctx.font = font(22, 600);
  ctx.fillStyle = "#8f8f8f"; // ink-dim
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    `${Math.min(sceneIndex + 1, sceneCount)} / ${sceneCount}`,
    w - marginX,
    barY - 16 * s,
  );
  ctx.textAlign = "left";
}

/**
 * Per-scene durations in seconds, proportional to narration length.
 * Every scene gets at least MIN_SCENE_SECONDS; the remaining budget is split
 * by narration word count, so totals ≈ script.durationSeconds (exactly, unless
 * the minimums alone exceed it).
 */
export function estimateSceneDurations(
  script: CadenceArtifacts["script"],
): number[] {
  const scenes = script.scenes;
  const n = scenes.length;
  if (n === 0) return [];

  const target = Math.max(script.durationSeconds || 0, MIN_SCENE_SECONDS * n);
  const weights = scenes.map((scene) =>
    Math.max(scene.narration.trim().split(/\s+/).filter(Boolean).length, 1),
  );
  const totalWeight = weights.reduce((sum, wgt) => sum + wgt, 0);
  const free = target - MIN_SCENE_SECONDS * n;

  // Round each scene to 0.1s, but give the last scene the remaining budget so
  // the durations always sum to exactly the target.
  const durations: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      durations.push(Math.round((target - allocated) * 10) / 10);
    } else {
      const d =
        Math.round((MIN_SCENE_SECONDS + (free * weights[i]) / totalWeight) * 10) /
        10;
      durations.push(d);
      allocated += d;
    }
  }
  return durations;
}
