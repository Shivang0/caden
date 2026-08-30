// POST /api/generate — fetch activity (GitHub + optional Linear/Notion) and
// run the Cadence content pipeline, behind a login/paywall gate.
//
// Gate rules (skipped entirely when CADENCE_OPEN_MODE=1 — the live-demo
// escape hatch; set it in .env.local or the shell to disable the paywall):
//   anonymous  → 1 free generation (tracked in a signed cookie), then 401
//   free user  → freeGenerationLimit generations per browser, then 402
//   pro user   → unlimited

import { cookies } from "next/headers";
import { z } from "zod";

import { runCadencePipeline } from "@/lib/agents";
import { cacheKey, loadLiveArtifacts, saveLiveArtifacts } from "@/lib/cache";
import {
  createUsageJwt,
  getSession,
  readUsageCount,
  USAGE_COOKIE,
  usageCookieOptions,
} from "@/lib/auth";
import {
  GitHubRateLimitError,
  InvalidRepoUrlError,
  RepoNotFoundError,
} from "@/lib/github";
import { applyConnections } from "@/lib/connect/merge";
import { gatherActivity } from "@/lib/sources";
import { getEntitlement } from "@/lib/stripe";
import type { GenerateRequest } from "@/lib/types";

export const maxDuration = 300;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Anonymous visitors get one demo generation before login is required.
const ANONYMOUS_FREE_LIMIT = 1;

const bodySchema = z.object({
  repoUrl: z.string().min(1, "repoUrl is required"),
  since: z.string().regex(ISO_DATE, "since must be an ISO date (YYYY-MM-DD)").optional(),
  until: z.string().regex(ISO_DATE, "until must be an ISO date (YYYY-MM-DD)").optional(),
  company: z.string().max(200).optional(),
  metricsNotes: z.string().max(10_000).optional(),
  tone: z.enum(["confident", "humble", "hype"]).optional(),
  // Optional source tokens — used for this request only, never stored,
  // logged, or echoed back in errors.
  linearApiKey: z.string().max(200, "linearApiKey is too long").optional(),
  notionToken: z.string().max(300, "notionToken is too long").optional(),
  vercelToken: z.string().max(300, "vercelToken is too long").optional(),
  vercelProjectId: z.string().max(200, "vercelProjectId is too long").optional(),
  stripeMetricsKey: z.string().max(300, "stripeMetricsKey is too long").optional(),
  figmaToken: z.string().max(300, "figmaToken is too long").optional(),
  figmaTeamId: z.string().max(200, "figmaTeamId is too long").optional(),
  posthogKey: z.string().max(300, "posthogKey is too long").optional(),
  posthogProjectId: z.string().max(200, "posthogProjectId is too long").optional(),
  posthogHost: z.string().max(300, "posthogHost is too long").optional(),
});

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return Response.json({ error: message }, { status: 400 });
  }

  // Defaults: until = today, since = 14 days before until.
  const until = parsed.data.until ?? isoDate(new Date());
  const since =
    parsed.data.since ??
    isoDate(new Date(Date.parse(`${until.slice(0, 10)}T00:00:00Z`) - 14 * 24 * 60 * 60 * 1000));

  const sinceMs = Date.parse(since.slice(0, 10));
  const untilMs = Date.parse(until.slice(0, 10));
  // Round-trip check: Date.parse rolls invalid dates over (2024-02-31 → Mar 2),
  // so NaN alone doesn't prove the date exists on the calendar.
  const isRealDate = (input: string, ms: number) =>
    !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === input.slice(0, 10);
  if (!isRealDate(since, sinceMs) || !isRealDate(until, untilMs)) {
    return Response.json(
      { error: "'since' and 'until' must be valid calendar dates (YYYY-MM-DD)." },
      { status: 400 },
    );
  }
  if (sinceMs > untilMs) {
    return Response.json({ error: "'since' must be on or before 'until'." }, { status: 400 });
  }

  // Resolve the session user FIRST — connections are scoped to this user.
  const user = await getSession(request);

  // One-click Connect: applyConnections fills credential fields from THIS
  // user's DB-stored connections, but ONLY where the body didn't supply a
  // value — an explicit body token always wins. Tokens are never logged.
  const generateRequest: GenerateRequest = await applyConnections(user?.id ?? null, {
    repoUrl: parsed.data.repoUrl,
    since,
    until,
    company: parsed.data.company,
    metricsNotes: parsed.data.metricsNotes,
    tone: parsed.data.tone ?? "confident",
    linearApiKey: parsed.data.linearApiKey?.trim() || undefined,
    notionToken: parsed.data.notionToken?.trim() || undefined,
    vercelToken: parsed.data.vercelToken?.trim() || undefined,
    vercelProjectId: parsed.data.vercelProjectId?.trim() || undefined,
    stripeMetricsKey: parsed.data.stripeMetricsKey?.trim() || undefined,
    figmaToken: parsed.data.figmaToken?.trim() || undefined,
    figmaTeamId: parsed.data.figmaTeamId?.trim() || undefined,
    posthogKey: parsed.data.posthogKey?.trim() || undefined,
    posthogProjectId: parsed.data.posthogProjectId?.trim() || undefined,
    posthogHost: parsed.data.posthogHost?.trim() || undefined,
  });

  // ---- Entitlement gate ----
  // CADENCE_OPEN_MODE=1 disables the gate entirely (demo escape hatch).
  const openMode = process.env.CADENCE_OPEN_MODE === "1";
  const usageCount = await readUsageCount(request);

  if (!openMode) {
    if (!user) {
      if (usageCount >= ANONYMOUS_FREE_LIMIT) {
        return Response.json({ error: "login_required" }, { status: 401 });
      }
    } else {
      const entitlement = await getEntitlement(user);
      if (entitlement.plan !== "pro" && usageCount >= entitlement.freeGenerationLimit) {
        return Response.json({ error: "payment_required" }, { status: 402 });
      }
    }
  }

  try {
    const { activity, sourceErrors } = await gatherActivity(generateRequest);
    let artifacts = await runCadencePipeline(activity, generateRequest);

    // Demo insurance: cache live results; if the provider failed and this exact
    // request has a cached live generation, serve that instead of the mock.
    // SECURITY: the cache key hashes only public request fields, so any request
    // that used private credentials (revenue, analytics, internal issues/docs)
    // must bypass the cache entirely — otherwise one founder's numbers could be
    // served to another whose request collides on the public fields.
    const usedPrivateSources = Boolean(
      generateRequest.linearApiKey ||
        generateRequest.notionToken ||
        generateRequest.vercelToken ||
        generateRequest.stripeMetricsKey ||
        generateRequest.figmaToken ||
        generateRequest.posthogKey
    );
    if (!usedPrivateSources) {
      const key = cacheKey(generateRequest);
      if (artifacts.meta.mock) {
        const cached = await loadLiveArtifacts(key);
        if (cached) {
          artifacts = { ...cached, meta: { ...cached.meta, cached: true } };
        }
      } else {
        await saveLiveArtifacts(key, artifacts);
      }
    }

    // Successful generation → bump the signed usage cookie (skipped in open
    // mode so demo runs never burn anyone's free try).
    if (!openMode) {
      const store = await cookies();
      store.set(USAGE_COOKIE, await createUsageJwt(usageCount + 1), usageCookieOptions());
    }

    // Response shape is CadenceArtifacts, plus an additive optional
    // sourceErrors: string[] when an optional source (Linear/Notion) failed.
    return Response.json(
      sourceErrors.length > 0 ? { ...artifacts, sourceErrors } : artifacts,
    );
  } catch (error) {
    if (error instanceof InvalidRepoUrlError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RepoNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GitHubRateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    console.error("[cadence] /api/generate failed:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected error while generating artifacts.";
    return Response.json({ error: message }, { status: 500 });
  }
}
