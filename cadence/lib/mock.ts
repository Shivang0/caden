// Deterministic, LLM-free artifact generation for Cadence.
// Used when no AI gateway key is configured, and as the graceful fallback
// when the model pipeline fails. Derives themes and copy from real commit
// messages, PR titles, releases, and founder-supplied metrics notes.

import type { CadenceArtifacts, GenerateRequest, RepoActivity, VideoScene } from "@/lib/types";

type ThemeKey =
  | "feat"
  | "fix"
  | "perf"
  | "docs"
  | "refactor"
  | "infra"
  | "test"
  | "general";

const THEME_LABELS: Record<ThemeKey, string> = {
  feat: "New features",
  fix: "Reliability & bug fixes",
  perf: "Performance",
  docs: "Docs & onboarding",
  refactor: "Code quality",
  infra: "Infrastructure & tooling",
  test: "Testing & stability",
  general: "Core product work",
};

interface WorkItem {
  text: string;
  theme: ThemeKey;
  prNumber?: number;
}

// ---- Text helpers ----

function firstLine(message: string): string {
  return message.split("\n", 1)[0].trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Strip conventional-commit prefixes for display: "feat(api): add x" → "Add x". */
function cleanTitle(title: string): string {
  const stripped = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "").trim();
  return capitalize(stripped || title.trim());
}

function isNoise(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.startsWith("merge pull request") ||
    t.startsWith("merge branch") ||
    t.startsWith("merge remote") ||
    t.length < 3
  );
}

function classify(title: string): ThemeKey {
  const t = title.toLowerCase();
  const prefixMatch = t.match(/^([a-z]+)(\([^)]*\))?!?:/);
  const prefix = prefixMatch?.[1] ?? "";

  if (["feat", "feature"].includes(prefix)) return "feat";
  if (["fix", "bugfix", "hotfix"].includes(prefix)) return "fix";
  if (prefix === "perf") return "perf";
  if (["docs", "doc"].includes(prefix)) return "docs";
  if (["refactor", "style", "chore"].includes(prefix)) return "refactor";
  if (["ci", "build", "deps", "infra", "release"].includes(prefix)) return "infra";
  if (prefix === "test") return "test";

  if (/\b(fix|bug|crash|error|patch|resolve)\b/.test(t)) return "fix";
  if (/\b(add|new|launch|ship|introduce|implement|support|create)\b/.test(t)) return "feat";
  if (/\b(perf|faster|speed|optimi[sz]e|latency|cache)\b/.test(t)) return "perf";
  if (/\b(doc|docs|readme|guide|example)\b/.test(t)) return "docs";
  if (/\b(refactor|clean\s?up|rename|reorganiz|simplif)\b/.test(t)) return "refactor";
  if (/\b(ci|pipeline|deploy|docker|bump|upgrade|dependenc)\b/.test(t)) return "infra";
  if (/\btests?\b/.test(t)) return "test";
  return "general";
}

// ---- Work extraction ----

function extractWorkItems(activity: RepoActivity): WorkItem[] {
  const seen = new Set<string>();
  const items: WorkItem[] = [];

  const push = (raw: string, prNumber?: number) => {
    const line = firstLine(raw);
    if (isNoise(line)) return;
    const display = cleanTitle(line);
    const key = display.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ text: display, theme: classify(line), prNumber });
  };

  // PRs first — they are usually the most meaningful units of shipped work.
  for (const pr of activity.pullRequests) push(pr.title, pr.number);
  for (const commit of activity.commits) push(commit.message);

  return items;
}

function deriveThemes(items: WorkItem[]): { label: string; items: WorkItem[] }[] {
  const buckets = new Map<ThemeKey, WorkItem[]>();
  for (const item of items) {
    const bucket = buckets.get(item.theme) ?? [];
    bucket.push(item);
    buckets.set(item.theme, bucket);
  }

  const ranked = [...buckets.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, bucketItems]) => ({ label: THEME_LABELS[key], items: bucketItems }));

  const themes = ranked.slice(0, 5);

  // Guarantee at least 3 themes even for quiet repos.
  const fallbacks = ["Shipping velocity", "Core product work", "Team execution"];
  let i = 0;
  while (themes.length < 3 && i < fallbacks.length) {
    if (!themes.some((t) => t.label === fallbacks[i])) {
      themes.push({ label: fallbacks[i], items: [] });
    }
    i++;
  }

  return themes;
}

// ---- Tone helpers ----

function toneOpeners(tone: GenerateRequest["tone"], company: string, shippedCount: number): {
  tldr: string;
  closing: string;
  hook: string;
} {
  const t = tone ?? "confident";
  // Grammatical + honest phrasing across the 0/1/many cases.
  const n = shippedCount === 1 ? "1 improvement" : `${shippedCount} improvements`;
  if (t === "hype") {
    return {
      tldr: `${company} is on an absolute tear — ${n} shipped this cycle and the pace is only accelerating.`,
      closing: `The momentum is real. Next update will be even bigger. 🚀`,
      hook: `${company} just shipped ${n} in one cycle. Here's the breakdown 🧵`,
    };
  }
  if (t === "humble") {
    return {
      tldr: `Steady progress at ${company}: ${n} landed this cycle, with a focus on doing the fundamentals well.`,
      closing: `Grateful for the continued support — always happy to go deeper on any of this.`,
      hook: `A quiet but productive cycle at ${company} — ${n} shipped. A few highlights:`,
    };
  }
  return {
    tldr: `${company} shipped ${n} this cycle across product, reliability, and infrastructure — consistent execution against the roadmap.`,
    closing: `Momentum is strong and the roadmap is clear. More next cycle.`,
    hook: `${company} shipped ${n} this cycle. Here's what landed and why it matters:`,
  };
}

/** Format cents into a whole-unit currency string, e.g. 123456 → "$1,235". */
function formatCents(cents: number, currency: string | null): string {
  const code = (currency ?? "usd").toUpperCase();
  const whole = Math.round(cents / 100);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(whole);
  } catch {
    return `${code} ${whole.toLocaleString("en-US")}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---- Artifact builders ----

const PLANNING_THEME_LABEL = "Product & planning";

function hasPlanningWork(activity: RepoActivity): boolean {
  return (
    (activity.linearIssues?.length ?? 0) > 0 || (activity.notionPages?.length ?? 0) > 0
  );
}

/** "Product & planning" bullets derived from Linear issues + Notion docs. */
function planningLines(activity: RepoActivity): string[] {
  const lines: string[] = [];
  for (const issue of (activity.linearIssues ?? []).slice(0, 6)) {
    const extra = [issue.assignee, issue.project].filter(Boolean).join(", ");
    lines.push(`- Closed ${issue.identifier} — ${issue.title}${extra ? ` (${extra})` : ""}`);
  }
  for (const page of (activity.notionPages ?? []).slice(0, 4)) {
    lines.push(`- Updated "${page.title}" in Notion (${formatDate(page.lastEditedAt)})`);
  }
  return lines;
}

function buildMetricsLines(activity: RepoActivity, req: GenerateRequest): string[] {
  const lines: string[] = [];
  if (req.metricsNotes && req.metricsNotes.trim().length > 0) {
    for (const raw of req.metricsNotes.split("\n")) {
      const line = raw.trim();
      if (line) lines.push(line.startsWith("-") ? line : `- ${line}`);
    }
  }
  const revenue = activity.revenue;
  if (revenue) {
    if (revenue.mrrCents !== null) {
      lines.push(
        `- MRR ${formatCents(revenue.mrrCents, revenue.currency)}/mo from ${revenue.activeSubscriptions} active subscription${revenue.activeSubscriptions === 1 ? "" : "s"} (Stripe)`
      );
    } else {
      lines.push(
        `- ${revenue.activeSubscriptions} active subscription${revenue.activeSubscriptions === 1 ? "" : "s"} (Stripe)`
      );
    }
    lines.push(
      `- ${revenue.newCustomersInRange} new customer${revenue.newCustomersInRange === 1 ? "" : "s"} and ${formatCents(revenue.chargedInRangeCents, revenue.currency)} charged this period`
    );
  }
  const posthog = activity.posthog;
  if (posthog && (posthog.eventsInRange !== null || posthog.activeUsersInRange !== null)) {
    const bits: string[] = [];
    if (posthog.activeUsersInRange !== null) {
      bits.push(`${posthog.activeUsersInRange.toLocaleString("en-US")} active users`);
    }
    if (posthog.eventsInRange !== null) {
      bits.push(`${posthog.eventsInRange.toLocaleString("en-US")} events tracked`);
    }
    lines.push(`- ${bits.join(", ")} this period (PostHog)`);
  }
  lines.push(
    `- ${activity.commits.length} commits, ${activity.pullRequests.length} merged PRs, ${activity.releases.length} release${activity.releases.length === 1 ? "" : "s"} in this window`
  );
  if ((activity.linearIssues?.length ?? 0) > 0) {
    lines.push(`- ${activity.linearIssues?.length} Linear issue${activity.linearIssues?.length === 1 ? "" : "s"} closed`);
  }
  if ((activity.notionPages?.length ?? 0) > 0) {
    lines.push(`- ${activity.notionPages?.length} Notion doc${activity.notionPages?.length === 1 ? "" : "s"} updated`);
  }
  const authors = new Set(activity.commits.map((c) => c.author));
  if (authors.size > 0) {
    lines.push(`- ${authors.size} contributor${authors.size === 1 ? "" : "s"} actively shipping`);
  }
  return lines;
}

function buildInvestorUpdate(
  company: string,
  activity: RepoActivity,
  req: GenerateRequest,
  themes: { label: string; items: WorkItem[] }[],
  opener: { tldr: string; closing: string }
): string {
  const period = `${formatDate(activity.range.since)} – ${formatDate(activity.range.until)}`;
  const parts: string[] = [];

  parts.push(`# ${company} — Investor Update`);
  parts.push(`*${period}*`);
  parts.push("");
  parts.push(`**TL;DR:** ${opener.tldr}`);
  parts.push("");
  parts.push(`## Shipped`);

  for (const theme of themes) {
    if (theme.items.length === 0) continue;
    parts.push("");
    parts.push(`### ${theme.label}`);
    for (const item of theme.items.slice(0, 5)) {
      parts.push(`- ${item.text}${item.prNumber ? ` (#${item.prNumber})` : ""}`);
    }
  }

  if (activity.releases.length > 0) {
    parts.push("");
    parts.push(`### Releases`);
    for (const rel of activity.releases.slice(0, 5)) {
      parts.push(`- **${rel.name ?? rel.tag}** (${rel.tag}) — published ${formatDate(rel.publishedAt)}`);
    }
  }

  if (hasPlanningWork(activity)) {
    parts.push("");
    parts.push(`### ${PLANNING_THEME_LABEL}`);
    parts.push(...planningLines(activity));
  }

  parts.push("");
  parts.push(`## Metrics`);
  parts.push(...buildMetricsLines(activity, req));
  parts.push("");
  parts.push(`## Asks`);
  parts.push(`- Intros to design partners who feel the pain we're solving — reply and we'll send a one-pager.`);
  parts.push(`- If you know exceptional engineers looking for their next thing, we're always talking.`);
  parts.push("");
  parts.push(opener.closing);

  return parts.join("\n");
}

function buildLinkedinPost(
  company: string,
  themes: { label: string; items: WorkItem[] }[],
  activity: RepoActivity,
  req: GenerateRequest,
  hook: string
): string {
  const lines: string[] = [hook, ""];

  const highlights = themes.flatMap((t) => t.items).slice(0, 4);
  for (const h of highlights) {
    lines.push(`→ ${truncate(h.text, 110)}`);
  }

  lines.push("");
  if (req.metricsNotes && req.metricsNotes.trim()) {
    lines.push(`The numbers: ${truncate(firstLine(req.metricsNotes), 180)}`);
  } else {
    lines.push(
      `Behind the scenes: ${activity.commits.length} commits and ${activity.pullRequests.length} merged PRs this cycle.`
    );
  }
  lines.push("");
  lines.push(`Building in public — follow along for the next drop.`);

  return truncate(lines.join("\n"), 1300);
}

function buildXThread(
  company: string,
  themes: { label: string; items: WorkItem[] }[],
  activity: RepoActivity,
  req: GenerateRequest,
  hook: string
): string[] {
  const tweets: string[] = [];
  tweets.push(truncate(hook, 280));

  for (const theme of themes.slice(0, 3)) {
    if (theme.items.length === 0) continue;
    const top = theme.items
      .slice(0, 2)
      .map((i) => `• ${i.text}`)
      .join("\n");
    tweets.push(truncate(`${theme.label}:\n${top}`, 280));
  }

  const metricsLine =
    req.metricsNotes && req.metricsNotes.trim()
      ? firstLine(req.metricsNotes)
      : `${activity.commits.length} commits · ${activity.pullRequests.length} PRs merged · ${activity.releases.length} releases`;
  tweets.push(truncate(`By the numbers this cycle: ${metricsLine}`, 280));

  tweets.push(
    truncate(
      `That's the update. Star the repo, kick the tires, and tell us what to build next → ${activity.repo.url}`,
      280
    )
  );

  // Contract: 4-6 tweets.
  while (tweets.length < 4) {
    tweets.splice(
      1,
      0,
      truncate(`Consistent shipping compounds. ${company} moved fast again this cycle.`, 280)
    );
  }
  return tweets.slice(0, 6);
}

function buildChangelog(
  activity: RepoActivity,
  themes: { label: string; items: WorkItem[] }[]
): string {
  const parts: string[] = [];
  parts.push(`# Changelog`);
  parts.push(`*${formatDate(activity.range.since)} – ${formatDate(activity.range.until)}*`);

  for (const theme of themes) {
    if (theme.items.length === 0) continue;
    parts.push("");
    parts.push(`## ${theme.label}`);
    for (const item of theme.items.slice(0, 8)) {
      parts.push(`- ${item.text}${item.prNumber ? ` ([#${item.prNumber}](${activity.repo.url}/pull/${item.prNumber}))` : ""}`);
    }
  }

  if (hasPlanningWork(activity)) {
    parts.push("");
    parts.push(`## ${PLANNING_THEME_LABEL}`);
    parts.push(...planningLines(activity));
  }

  if (activity.releases.length > 0) {
    parts.push("");
    parts.push(`## Releases`);
    for (const rel of activity.releases) {
      parts.push(`- **${rel.tag}**${rel.name && rel.name !== rel.tag ? ` — ${rel.name}` : ""}`);
    }
  }

  return parts.join("\n");
}

function buildScript(
  company: string,
  themes: { label: string; items: WorkItem[] }[],
  activity: RepoActivity,
  req: GenerateRequest
): { durationSeconds: number; scenes: VideoScene[] } {
  const shipped = themes.flatMap((t) => t.items);
  const [themeA, themeB] = themes;
  const period = `${formatDate(activity.range.since)} to ${formatDate(activity.range.until)}`;

  // Real revenue/analytics numbers lead the metrics scene when present.
  const liveDataBullets: string[] = [];
  const revenue = activity.revenue;
  if (revenue?.mrrCents != null) {
    liveDataBullets.push(`MRR ${formatCents(revenue.mrrCents, revenue.currency)}/mo`);
  } else if (revenue) {
    liveDataBullets.push(
      `${revenue.activeSubscriptions} active subscription${revenue.activeSubscriptions === 1 ? "" : "s"}`
    );
  }
  if (activity.posthog?.activeUsersInRange != null) {
    liveDataBullets.push(
      `${activity.posthog.activeUsersInRange.toLocaleString("en-US")} active users`
    );
  } else if (activity.posthog?.eventsInRange != null) {
    liveDataBullets.push(
      `${activity.posthog.eventsInRange.toLocaleString("en-US")} events tracked`
    );
  }

  const metricsBullets = [
    ...liveDataBullets,
    ...(req.metricsNotes && req.metricsNotes.trim()
      ? req.metricsNotes
          .split("\n")
          .map((l) => l.replace(/^-\s*/, "").trim())
          .filter(Boolean)
      : [
          `${activity.commits.length} commits`,
          `${activity.pullRequests.length} PRs merged`,
          ...((activity.linearIssues?.length ?? 0) > 0
            ? [`${activity.linearIssues?.length} Linear issues closed`]
            : []),
          ...((activity.notionPages?.length ?? 0) > 0
            ? [`${activity.notionPages?.length} Notion docs updated`]
            : []),
          `${activity.releases.length} releases`,
        ]),
  ].slice(0, 3);

  const themeAItems = (themeA?.items ?? shipped).slice(0, 3);
  const themeBItems = (themeB?.items ?? shipped.slice(3)).slice(0, 3);

  const scenes: VideoScene[] = [
    {
      id: "hook",
      title: `${company}: what we shipped`,
      bullets: [period, shipped.length === 1 ? `1 improvement landed` : `${shipped.length} improvements landed`],
      narration: `Hey, quick update from ${company}. Over the last cycle, from ${period}, we shipped ${shipped.length === 1 ? "1 real improvement" : `${shipped.length} real improvements`}. Here's what actually landed — and why it matters.`,
    },
    {
      id: "shipped-1",
      title: themeA?.label ?? "What shipped",
      bullets: themeAItems.map((i) => truncate(i.text, 60)),
      narration:
        themeAItems.length > 0
          ? `First up, ${(themeA?.label ?? "the product").toLowerCase()}. ${themeAItems
              .map((i) => i.text)
              .join(". ")}. Each of these came straight out of real usage.`
          : `First up, the team kept a steady shipping cadence across the whole product surface.`,
    },
    {
      id: "shipped-2",
      title: themeB?.label ?? "More improvements",
      bullets: themeBItems.map((i) => truncate(i.text, 60)),
      narration:
        themeBItems.length > 0
          ? `We also invested in ${(themeB?.label ?? "polish").toLowerCase()}. ${themeBItems
              .map((i) => i.text)
              .join(". ")}. Less flashy, but this is what makes the product feel solid.`
          : `We also spent real time on polish and reliability — the unglamorous work that makes everything else possible.`,
    },
    {
      id: "metrics",
      title: "By the numbers",
      bullets: metricsBullets.map((b) => truncate(b, 60)),
      narration: `Now the numbers. ${metricsBullets.join(". ")}. Momentum you can measure, not just vibes.`,
    },
    {
      id: "cta",
      title: "What's next",
      bullets: ["Follow along", "Intros welcome", truncate(activity.repo.url, 60)],
      narration: `That's the update. If you know someone who should be using ${company} — or building it with us — send them our way. See you next cycle.`,
    },
  ];

  return { durationSeconds: 75, scenes };
}

// ---- Public API ----

export function mockArtifacts(activity: RepoActivity, req: GenerateRequest): CadenceArtifacts {
  const company = req.company?.trim() || activity.repo.name;
  const items = extractWorkItems(activity);
  const themes = deriveThemes(items);
  const opener = toneOpeners(req.tone, company, items.length);

  // Surface planning work (Linear/Notion) as a theme — contract allows 3-5.
  const themeLabels = themes.map((t) => t.label);
  if (hasPlanningWork(activity) && !themeLabels.includes(PLANNING_THEME_LABEL)) {
    themeLabels.length = Math.min(themeLabels.length, 4);
    themeLabels.push(PLANNING_THEME_LABEL);
  }

  return {
    company,
    themes: themeLabels,
    investorUpdate: buildInvestorUpdate(company, activity, req, themes, opener),
    linkedinPost: buildLinkedinPost(company, themes, activity, req, opener.hook),
    xThread: buildXThread(company, themes, activity, req, opener.hook),
    changelog: buildChangelog(activity, themes),
    script: buildScript(company, themes, activity, req),
    meta: {
      mock: true,
      model: "mock",
      commitCount: activity.commits.length,
      prCount: activity.pullRequests.length,
      releaseCount: activity.releases.length,
    },
  };
}
