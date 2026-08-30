// Artifact cache: demo insurance against provider rate limits.
// Every successful LIVE (non-mock) generation is stored in memory and written
// through to .cadence-cache/ (dev/self-hosted only — Vercel functions get the
// in-memory layer for the life of the instance). If a later identical request
// degrades to mock because the LLM provider failed, we serve the cached live
// result instead — meta.cached marks it.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CadenceArtifacts, GenerateRequest } from "@/lib/types";

const memory = new Map<string, CadenceArtifacts>();

const CACHE_DIR = path.join(process.cwd(), ".cadence-cache");

export function cacheKey(req: GenerateRequest): string {
  const raw = [
    req.repoUrl.toLowerCase().replace(/\/+$/, ""),
    req.since,
    req.until,
    req.company ?? "",
    req.tone ?? "confident",
    req.metricsNotes ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export async function saveLiveArtifacts(key: string, artifacts: CadenceArtifacts): Promise<void> {
  if (artifacts.meta.mock) return; // only cache real generations
  memory.set(key, artifacts);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(artifacts), "utf8");
  } catch {
    // read-only filesystem (serverless) — memory layer still applies
  }
}

export async function loadLiveArtifacts(key: string): Promise<CadenceArtifacts | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${key}.json`), "utf8");
    const parsed = JSON.parse(raw) as CadenceArtifacts;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}
