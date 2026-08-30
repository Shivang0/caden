// GET /api/autopilot — everything the generator form used to ask for, derived
// from the signed-in founder's connections instead. The demo page calls this on
// load and pre-fills itself: repos from GitHub, live metrics from Stripe, the
// founder's name from LinkedIn. Every section degrades to null independently
// so one dead connection never blanks the others.

import { getSession } from "@/lib/auth";
import { readConnectionToken } from "@/lib/connect/store";
import { fetchRevenueSnapshot } from "@/lib/stripe-metrics";
import { findUserById } from "@/lib/users";
import type { RevenueSnapshot } from "@/lib/types";

export const runtime = "nodejs";

const WINDOW_DAYS = 7;

interface RepoSummary {
  fullName: string;
  pushedAt: string;
  private: boolean;
  description: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ghJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "caden-autopilot",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`github_${res.status}`);
  return res.json();
}

/** Repos across the user and all their orgs that were pushed inside the window. */
async function githubContext(token: string, sinceIso: string) {
  const me = (await ghJson("https://api.github.com/user", token)) as { login?: string };
  const orgs = (await ghJson("https://api.github.com/user/orgs?per_page=5", token).catch(() => [])) as Array<{
    login?: string;
  }>;

  const repoLists = await Promise.all([
    ghJson("https://api.github.com/user/repos?sort=pushed&per_page=30&affiliation=owner,organization_member", token).catch(
      () => []
    ),
    ...orgs
      .filter((o) => o.login)
      .slice(0, 3)
      .map((o) => ghJson(`https://api.github.com/orgs/${o.login}/repos?sort=pushed&per_page=30`, token).catch(() => [])),
  ]);

  const seen = new Set<string>();
  const active: RepoSummary[] = [];
  for (const list of repoLists as Array<Array<Record<string, unknown>>>) {
    for (const r of list) {
      const fullName = typeof r.full_name === "string" ? r.full_name : "";
      const pushedAt = typeof r.pushed_at === "string" ? r.pushed_at : "";
      if (!fullName || !pushedAt || seen.has(fullName)) continue;
      seen.add(fullName);
      if (pushedAt.slice(0, 10) < sinceIso) continue;
      active.push({
        fullName,
        pushedAt,
        private: Boolean(r.private),
        description: typeof r.description === "string" ? r.description : null,
      });
    }
  }
  active.sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1));

  return {
    login: me.login ?? "",
    orgs: orgs.map((o) => o.login).filter(Boolean) as string[],
    repos: active.slice(0, 12),
  };
}

function metricsText(rev: RevenueSnapshot): string {
  const lines: string[] = [];
  const cur = (rev.currency ?? "usd").toUpperCase();
  if (rev.mrrCents !== null) lines.push(`MRR: ${(rev.mrrCents / 100).toFixed(0)} ${cur} (live from Stripe)`);
  lines.push(`Active subscriptions: ${rev.activeSubscriptions}`);
  lines.push(`New customers, last ${WINDOW_DAYS} days: ${rev.newCustomersInRange}`);
  if (rev.chargedInRangeCents > 0)
    lines.push(`Cash collected, last ${WINDOW_DAYS} days: ${(rev.chargedInRangeCents / 100).toFixed(0)} ${cur}`);
  return lines.join("\n");
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });

  const until = new Date();
  const since = new Date(until.getTime() - WINDOW_DAYS * 864e5);
  const range = { from: isoDate(since), to: isoDate(until) };

  const [githubToken, stripeKey, linkedinToken, userDoc] = await Promise.all([
    readConnectionToken(user.id, "github"),
    readConnectionToken(user.id, "stripe"),
    readConnectionToken(user.id, "linkedin"),
    findUserById(user.id),
  ]);

  // Founder identity: LinkedIn beats the account name because it is the name
  // their audience actually knows (and what Linkup should search for).
  let founder: { name: string; source: "linkedin" | "account" } = {
    name: user.name || "",
    source: "account",
  };
  if (linkedinToken) {
    try {
      const me = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${linkedinToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (me.ok) {
        const profile = (await me.json()) as { name?: string };
        if (profile.name) founder = { name: profile.name, source: "linkedin" };
      }
    } catch {
      // keep the account-name fallback
    }
  }

  const [github, revenue] = await Promise.all([
    githubToken
      ? githubContext(githubToken, range.from).catch(() => null)
      : Promise.resolve(null),
    stripeKey
      ? fetchRevenueSnapshot(stripeKey, range.from, range.to).catch(() => null)
      : Promise.resolve(null),
  ]);

  return Response.json({
    range,
    founder,
    linkedinConnected: Boolean(linkedinToken),
    github,
    metrics: revenue ? { snapshot: revenue, text: metricsText(revenue) } : null,
    // The founder's cloned voice, pinned to their profile on /connections.
    // Videos generated anywhere speak in it automatically.
    voiceId: userDoc?.voiceId ?? null,
  });
}
