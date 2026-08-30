// Multi-agent content pipeline for Cadence, built on the Vercel AI SDK (ai@7).
// A plain string model id (e.g. "anthropic/claude-sonnet-4.5") routes through
// the Vercel AI Gateway using AI_GATEWAY_API_KEY.
//
// Pipeline:
//   1. ANALYST   — extracts themes/highlights/metrics from raw repo activity
//   2-5. WRITERS — investor update, LinkedIn post, X thread, changelog (parallel)
//   6. NARRATOR  — 60-90s video script matching the VideoScene[] contract
//
// Every failure path degrades to mockArtifacts() — the pipeline never throws.

import { generateObject, generateText, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

import { mockArtifacts } from "@/lib/mock";
import type { CadenceArtifacts, GenerateRequest, RepoActivity, VideoScene } from "@/lib/types";

const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

// Model routing: AI Gateway (string id) → Anthropic direct → NVIDIA NIM →
// OpenRouter → mock. CADENCE_MODEL uses the "provider/model" form everywhere;
// the direct Anthropic route strips the provider prefix. The NVIDIA route
// serves its own catalog, so it has its own model id (NVIDIA_MODEL).
function resolveModel(): { model: LanguageModel; label: string } | null {
  const modelId = process.env.CADENCE_MODEL || DEFAULT_MODEL;
  if (process.env.AI_GATEWAY_API_KEY) {
    return { model: modelId, label: modelId };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const bare = modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
    return { model: anthropic(bare), label: `anthropic:${bare}` };
  }
  if (process.env.NVIDIA_API_KEY) {
    const nvidiaModel = process.env.NVIDIA_MODEL || "moonshotai/kimi-k3";
    const nvidia = createOpenAICompatible({
      name: "nvidia",
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY,
    });
    return { model: nvidia(nvidiaModel), label: `nvidia:${nvidiaModel}` };
  }
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return { model: openrouter(modelId), label: `openrouter:${modelId}` };
  }
  return null;
}

// ---- Structured-output resilience ----
// Some providers (e.g. Kimi K3 via NVIDIA NIM) don't support JSON-schema
// response format, which makes generateObject throw NoObjectGeneratedError.
// Fall back to plain text generation with an explicit shape hint, then strip
// fences, extract the outermost JSON object, and zod-validate it ourselves.
// Set once per request by runCadencePipeline: providers known to lack JSON-schema
// support skip the doomed generateObject attempt (saves a full completion per call).
let preferTextJson = false;
export function setPreferTextJson(value: boolean): void {
  preferTextJson = value;
}

async function generateObjectSafe<T>(opts: {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  shapeHint: string;
}): Promise<T> {
  try {
    if (preferTextJson) throw new Error("skip-native-structured-output");
    const { object } = await generateObject({
      model: opts.model,
      schema: opts.schema,
      system: opts.system,
      prompt: opts.prompt,
      maxRetries: 4,
    });
    return object;
  } catch {
    const { text } = await generateText({
      model: opts.model,
      maxRetries: 4,
      system: opts.system,
      prompt: `${opts.prompt}

Respond with ONLY a valid JSON object of this exact shape (no markdown fences, no commentary):
${opts.shapeHint}`,
    });
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = opts.schema.safeParse(JSON.parse(candidate));
    if (!parsed.success) {
      throw new Error(`Model JSON did not match the expected shape: ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data;
  }
}

// ---- Schemas ----

const analystSchema = z.object({
  themes: z
    .array(z.string())
    .describe("3-5 short labels for the main areas of shipped work"),
  highlights: z
    .array(z.string())
    .describe("The 5-8 most impressive concrete things shipped, phrased for a founder update"),
  metricsMentioned: z
    .array(z.string())
    .describe("Every concrete metric found in the activity or founder notes, verbatim-ish"),
});

type AnalystOutput = z.infer<typeof analystSchema>;

const threadSchema = z.object({
  tweets: z
    .array(z.string())
    .describe("4-6 tweets, each under 280 characters, first one is the hook"),
});

const scriptSchema = z.object({
  durationSeconds: z
    .number()
    .describe("Target runtime of the narrated video in seconds, between 60 and 90"),
  scenes: z.array(
    z.object({
      id: z.string().describe("kebab-case scene id, e.g. 'hook', 'shipped-1'"),
      title: z.string().describe("Short on-screen headline, max ~8 words"),
      bullets: z.array(z.string()).describe("Up to 3 short on-screen lines"),
      narration: z
        .string()
        .describe("What the voiceover says during this scene, conversational founder voice"),
    })
  ),
});

// ---- Context building ----

function buildActivityDigest(activity: RepoActivity, req: GenerateRequest): string {
  const lines: string[] = [];
  const company = req.company?.trim() || activity.repo.name;

  // Format cents into a whole-unit currency string, e.g. 123456 → "$1,235".
  const money = (cents: number, currency: string | null): string => {
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
  };

  lines.push(`Company/product: ${company}`);
  lines.push(`Repository: ${activity.repo.owner}/${activity.repo.name} (${activity.repo.url})`);
  if (activity.repo.description) lines.push(`Repo description: ${activity.repo.description}`);
  lines.push(`Period: ${activity.range.since} to ${activity.range.until}`);
  const totals = [
    `${activity.commits.length} commits`,
    `${activity.pullRequests.length} merged PRs`,
    `${activity.releases.length} releases`,
  ];
  if (activity.linearIssues && activity.linearIssues.length > 0) {
    totals.push(`${activity.linearIssues.length} completed Linear issues`);
  }
  if (activity.notionPages && activity.notionPages.length > 0) {
    totals.push(`${activity.notionPages.length} Notion docs updated`);
  }
  if (activity.googleDocs && activity.googleDocs.length > 0) {
    totals.push(`${activity.googleDocs.length} Google Drive files updated`);
  }
  if (activity.deployments && activity.deployments.length > 0) {
    totals.push(`${activity.deployments.length} production deploys`);
  }
  if (activity.figmaFiles && activity.figmaFiles.length > 0) {
    totals.push(`${activity.figmaFiles.length} Figma files updated`);
  }
  lines.push(`Totals: ${totals.join(", ")}`);

  if (activity.pullRequests.length > 0) {
    lines.push("", "Merged pull requests:");
    for (const pr of activity.pullRequests.slice(0, 40)) {
      lines.push(`- #${pr.number} ${pr.title} (by ${pr.author})`);
    }
  }

  if (activity.commits.length > 0) {
    lines.push("", "Commits (first line only):");
    for (const commit of activity.commits.slice(0, 80)) {
      lines.push(`- ${commit.message.split("\n", 1)[0]} (${commit.author})`);
    }
  }

  if (activity.releases.length > 0) {
    lines.push("", "Releases:");
    for (const rel of activity.releases) {
      lines.push(`- ${rel.tag}${rel.name ? ` "${rel.name}"` : ""} published ${rel.publishedAt}`);
    }
  }

  if (activity.linearIssues && activity.linearIssues.length > 0) {
    lines.push("", "Completed Linear issues:");
    for (const issue of activity.linearIssues.slice(0, 50)) {
      const extra = [issue.assignee, issue.project].filter(Boolean).join(", ");
      lines.push(`- ${issue.identifier} ${issue.title}${extra ? ` (${extra})` : ""}`);
    }
  }

  if (activity.notionPages && activity.notionPages.length > 0) {
    lines.push("", "Docs updated in Notion:");
    for (const page of activity.notionPages.slice(0, 30)) {
      lines.push(`- ${page.title} (edited ${page.lastEditedAt.slice(0, 10)})`);
    }
  }

  if (activity.googleDocs && activity.googleDocs.length > 0) {
    lines.push("", "Google Drive files updated:");
    for (const file of activity.googleDocs.slice(0, 30)) {
      lines.push(`- ${file.name} (edited ${file.modifiedAt.slice(0, 10)})`);
    }
  }

  if (activity.deployments && activity.deployments.length > 0) {
    lines.push("", "Production deployments:");
    for (const deploy of activity.deployments.slice(0, 20)) {
      lines.push(
        `- ${deploy.projectName ?? "unknown project"} — ${deploy.state} (${deploy.createdAt.slice(0, 10)})`
      );
    }
  }

  if (activity.revenue) {
    const rev = activity.revenue;
    lines.push("", "Revenue (Stripe, treat as ground truth):");
    if (rev.mrrCents !== null) {
      lines.push(`- MRR: ${money(rev.mrrCents, rev.currency)}/mo`);
    }
    lines.push(`- Active subscriptions: ${rev.activeSubscriptions}`);
    lines.push(`- New customers this period: ${rev.newCustomersInRange}`);
    lines.push(`- Charged this period: ${money(rev.chargedInRangeCents, rev.currency)}`);
  }

  if (activity.figmaFiles && activity.figmaFiles.length > 0) {
    lines.push("", "Design files updated (Figma):");
    for (const file of activity.figmaFiles.slice(0, 30)) {
      lines.push(`- ${file.name} (updated ${file.lastModified.slice(0, 10)})`);
    }
  }

  if (
    activity.posthog &&
    (activity.posthog.eventsInRange !== null || activity.posthog.activeUsersInRange !== null)
  ) {
    lines.push("", "Product analytics (PostHog):");
    if (activity.posthog.eventsInRange !== null) {
      lines.push(`- Events in period: ${activity.posthog.eventsInRange.toLocaleString("en-US")}`);
    }
    if (activity.posthog.activeUsersInRange !== null) {
      lines.push(
        `- Active users in period: ${activity.posthog.activeUsersInRange.toLocaleString("en-US")}`
      );
    }
  }

  if (activity.webMentions && activity.webMentions.length > 0) {
    lines.push("", "Press & web mentions this period (cite where they strengthen the story):");
    for (const mention of activity.webMentions) {
      lines.push(`- ${mention.title} (${mention.url})${mention.snippet ? ` — ${mention.snippet.slice(0, 140)}` : ""}`);
    }
  }

  if (req.metricsNotes && req.metricsNotes.trim()) {
    lines.push("", "Founder-provided metrics & context (treat as ground truth, weave in):");
    lines.push(req.metricsNotes.trim());
  }

  return lines.join("\n");
}

function toneGuide(tone: GenerateRequest["tone"]): string {
  switch (tone ?? "confident") {
    case "hype":
      return "Tone: high-energy and bold. Big claims backed by the real shipped work. Exclamation is fine, emoji sparingly.";
    case "humble":
      return "Tone: understated and sincere. Let the work speak for itself, acknowledge what's still hard. No bragging.";
    case "confident":
    default:
      return "Tone: confident and direct. Founder who knows where the company is going. No fluff, no corporate speak.";
  }
}

// ---- Writer agents ----

async function writeInvestorUpdate(
  model: LanguageModel,
  company: string,
  digest: string,
  analyst: AnalystOutput,
  tone: string
): Promise<string> {
  const { text } = await generateText({
    model,
    maxRetries: 4,
    system: `You are a seasoned startup founder writing a monthly investor update. ${tone} Write in markdown. Ground every claim in the provided activity — never invent metrics or features.`,
    prompt: `Write the investor update for ${company}.

Structure (markdown):
- H1 title with company name and period
- **TL;DR:** one punchy paragraph
- "## Shipped" — grouped under the themes below, bullets referencing real PR/commit titles (reworded for humans, include PR numbers where given)
- "## Metrics" — use the founder metrics verbatim where provided; include shipping stats
- "## Asks" — 2-3 specific, realistic asks (intros, hiring, feedback)
- A short closing line

Themes from the analyst: ${analyst.themes.join("; ")}
Highlights: ${analyst.highlights.join("; ")}
Metrics identified: ${analyst.metricsMentioned.join("; ") || "none beyond shipping stats"}

Raw activity:
${digest}

Return ONLY the markdown document, no preamble.`,
  });
  return text.trim();
}

async function writeLinkedinPost(
  model: LanguageModel,
  company: string,
  digest: string,
  analyst: AnalystOutput,
  tone: string
): Promise<string> {
  const { text } = await generateText({
    model,
    maxRetries: 4,
    system: `You write LinkedIn posts for startup founders that people actually read. ${tone} Plain text only — no markdown syntax.`,
    prompt: `Write a LinkedIn post about what ${company} shipped this cycle.

Rules:
- First line is a scroll-stopping hook (no "I'm excited to announce")
- Short lines, generous line breaks, easy to skim
- Mention 3-4 concrete things shipped, from the highlights below
- Work in one real metric if available
- End with a light call to action
- HARD LIMIT: 1300 characters total
- At most 1-2 hashtags at the very end, or none

Highlights: ${analyst.highlights.join("; ")}
Metrics: ${analyst.metricsMentioned.join("; ") || "shipping stats only"}

Raw activity:
${digest}

Return ONLY the post text.`,
  });
  return text.trim().slice(0, 1300);
}

async function writeXThread(
  model: LanguageModel,
  company: string,
  digest: string,
  analyst: AnalystOutput,
  tone: string
): Promise<string[]> {
  const object = await generateObjectSafe({
    model,
    schema: threadSchema,
    shapeHint: `{"tweets": ["tweet 1 text", "tweet 2 text", ...]} // 4-6 tweets, each under 280 chars`,
    system: `You write X (Twitter) threads for startup founders. ${tone} Every tweet must stand alone and be under 280 characters.`,
    prompt: `Write a 4-6 tweet thread about what ${company} shipped this cycle.

- Tweet 1: hook with a concrete number (things shipped, a metric)
- Middle tweets: the most interesting shipped work, grounded in the real PR/commit titles
- One tweet with metrics if available
- Final tweet: call to action

Themes: ${analyst.themes.join("; ")}
Highlights: ${analyst.highlights.join("; ")}
Metrics: ${analyst.metricsMentioned.join("; ") || "shipping stats only"}

Raw activity:
${digest}`,
  });

  const tweets = object.tweets
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 280 ? `${t.slice(0, 279)}…` : t))
    .slice(0, 6);

  while (tweets.length < 4) {
    tweets.push(`More from ${company} soon — follow along for the next cycle.`);
  }
  return tweets;
}

async function writeChangelog(
  model: LanguageModel,
  company: string,
  digest: string,
  analyst: AnalystOutput
): Promise<string> {
  const { text } = await generateText({
    model,
    maxRetries: 4,
    system: `You write crisp, user-facing changelogs. Markdown. Group entries by theme. Reword raw commit/PR titles into clear user-facing language, keep PR numbers where given. Never invent entries.`,
    prompt: `Write the changelog for ${company} for this period.

Structure:
- H1 "Changelog" with the date range
- One H2 per theme (use these themes where they fit: ${analyst.themes.join("; ")})
- Bullets under each, derived from the real PRs/commits below
- A "Releases" section if there are releases

Raw activity:
${digest}

Return ONLY the markdown.`,
  });
  return text.trim();
}

async function writeScript(
  model: LanguageModel,
  company: string,
  digest: string,
  analyst: AnalystOutput,
  tone: string
): Promise<{ durationSeconds: number; scenes: VideoScene[] }> {
  const object = await generateObjectSafe({
    model,
    schema: scriptSchema,
    shapeHint: `{"durationSeconds": 75, "scenes": [{"id": "hook", "title": "...", "bullets": ["...", "..."], "narration": "..."}, ...]} // exactly 5 scenes`,
    system: `You are a narrator writing a short founder video update. ${tone} The narration should sound like a founder talking to camera — conversational, contractions, no corporate speak. Total narration should read aloud in 60-90 seconds.`,
    prompt: `Write a 5-scene video script for ${company}'s update this cycle.

Scenes, in order:
1. id "hook" — grab attention, name the company and the period
2. id "shipped-1" — the biggest theme of shipped work, concrete items
3. id "shipped-2" — the second theme, concrete items
4. id "metrics" — the numbers (founder metrics first if provided, else shipping stats)
5. id "cta" — the ask / what's next / where to follow

Each scene: short on-screen title, up to 3 short bullets, and narration.
Ground everything in the real activity below.

Themes: ${analyst.themes.join("; ")}
Highlights: ${analyst.highlights.join("; ")}
Metrics: ${analyst.metricsMentioned.join("; ") || "shipping stats only"}

Raw activity:
${digest}`,
  });

  const scenes: VideoScene[] = object.scenes.slice(0, 6).map((scene, index) => ({
    id: scene.id?.trim() || `scene-${index + 1}`,
    title: scene.title.trim(),
    bullets: scene.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 3),
    narration: scene.narration.trim(),
  }));

  if (scenes.length < 4) {
    throw new Error(`Narrator returned ${scenes.length} scenes; expected 4-6.`);
  }

  const durationSeconds = Math.min(90, Math.max(60, Math.round(object.durationSeconds || 75)));
  return { durationSeconds, scenes };
}

// ---- Public API ----

export async function runCadencePipeline(
  activity: RepoActivity,
  req: GenerateRequest
): Promise<CadenceArtifacts> {
  const resolved = resolveModel();
  if (!resolved) {
    return mockArtifacts(activity, req);
  }

  const { model, label: modelLabel } = resolved;
  setPreferTextJson(modelLabel.startsWith("nvidia:"));
  const company = req.company?.trim() || activity.repo.name;
  const digest = buildActivityDigest(activity, req);
  const tone = toneGuide(req.tone);

  try {
    // Agent 1: ANALYST
    const analystRaw = await generateObjectSafe({
      model,
      schema: analystSchema,
      shapeHint: `{"themes": ["3-5 short labels"], "highlights": ["5-8 concrete shipped things"], "metricsMentioned": ["every concrete metric found"]}`,
      system:
        "You are a sharp startup analyst. You read raw engineering activity (commits, PRs, releases) plus founder notes and extract what actually matters for external communication. Be concrete; never invent.",
      prompt: `Analyze this repo activity and founder context. Extract 3-5 themes of shipped work, the standout highlights, and every concrete metric mentioned.

${digest}`,
    });

    const analyst: AnalystOutput = {
      themes: analystRaw.themes.map((t) => t.trim()).filter(Boolean).slice(0, 5),
      highlights: analystRaw.highlights.map((h) => h.trim()).filter(Boolean),
      metricsMentioned: analystRaw.metricsMentioned.map((m) => m.trim()).filter(Boolean),
    };
    while (analyst.themes.length < 3) {
      analyst.themes.push(["Core product work", "Reliability", "Team execution"][analyst.themes.length % 3]);
    }

    // Agents 2-5: WRITERS, Agent 6: NARRATOR — all depend only on the analyst.
    // Each writer degrades independently to its deterministic mock counterpart,
    // so one malformed model response never discards the other successful ones.
    // Free-tier providers (NVIDIA NIM) rate-limit bursts, so cap concurrency
    // there; full parallelism everywhere else.
    const settle = <T>(label: string, fn: () => Promise<T>): (() => Promise<T | null>) =>
      () =>
        fn().catch((error: unknown) => {
          console.error(`[cadence] ${label} agent failed, using mock fallback:`, error);
          return null;
        });

    const writerTasks = [
      settle("investor-update", () => writeInvestorUpdate(model, company, digest, analyst, tone)),
      settle("linkedin", () => writeLinkedinPost(model, company, digest, analyst, tone)),
      settle("x-thread", () => writeXThread(model, company, digest, analyst, tone)),
      settle("changelog", () => writeChangelog(model, company, digest, analyst)),
      settle("narrator", () => writeScript(model, company, digest, analyst, tone)),
    ] as const;

    const concurrency = modelLabel.startsWith("nvidia:") ? 3 : writerTasks.length;
    const results: unknown[] = new Array(writerTasks.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (next < writerTasks.length) {
          const index = next++;
          results[index] = await writerTasks[index]();
        }
      })
    );
    const [investorUpdate, linkedinPost, xThread, changelog, script] = results as [
      Awaited<ReturnType<typeof writeInvestorUpdate>> | null,
      Awaited<ReturnType<typeof writeLinkedinPost>> | null,
      Awaited<ReturnType<typeof writeXThread>> | null,
      Awaited<ReturnType<typeof writeChangelog>> | null,
      Awaited<ReturnType<typeof writeScript>> | null,
    ];

    let mockFallback: CadenceArtifacts | null = null;
    const mock = (): CadenceArtifacts =>
      (mockFallback ??= mockArtifacts(activity, req));

    return {
      company,
      themes: analyst.themes,
      investorUpdate: investorUpdate ?? mock().investorUpdate,
      linkedinPost: linkedinPost ?? mock().linkedinPost,
      xThread: xThread ?? mock().xThread,
      changelog: changelog ?? mock().changelog,
      script: script ?? mock().script,
      meta: {
        mock: false,
        model: modelLabel,
        commitCount: activity.commits.length,
        prCount: activity.pullRequests.length,
        releaseCount: activity.releases.length,
      },
    };
  } catch (error) {
    // The model must never take the request down — degrade to the deterministic pipeline.
    console.error("[cadence] LLM pipeline failed, falling back to mock artifacts:", error);
    return mockArtifacts(activity, req);
  }
}
