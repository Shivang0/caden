// Shared contract for Cadence. All features build against these types.
// Do not change shapes without updating every consumer.

export interface LinearIssue {
  identifier: string; // e.g. ENG-142
  title: string;
  completedAt: string;
  assignee: string | null;
  project: string | null;
}

export interface NotionPage {
  id: string;
  title: string;
  lastEditedAt: string;
  url: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: string;
  url?: string;
}

export interface VercelDeployment {
  id: string;
  projectName: string | null;
  url: string | null;
  state: string; // READY, ERROR, ...
  target: string | null; // production | preview
  createdAt: string;
}

// Pulled from the FOUNDER's Stripe account (their metrics key) — unrelated to
// the app's own billing. Numbers feed the Metrics section of the update.
export interface RevenueSnapshot {
  currency: string | null;
  mrrCents: number | null; // normalized monthly run-rate from active subscriptions
  activeSubscriptions: number;
  newCustomersInRange: number;
  chargedInRangeCents: number; // succeeded charges within the period
}

export interface FigmaFileActivity {
  key: string;
  name: string;
  lastModified: string;
  url: string;
}

export interface PosthogSnapshot {
  eventsInRange: number | null;
  activeUsersInRange: number | null;
}

// Press/web mentions found via Linkup (server-side key, applies to every
// generation — not a per-user connection).
export interface WebMention {
  title: string;
  url: string;
  snippet: string;
}

export interface RepoActivity {
  repo: { owner: string; name: string; url: string; description: string | null };
  range: { since: string; until: string }; // ISO dates
  commits: Array<{ sha: string; message: string; author: string; date: string }>;
  pullRequests: Array<{
    number: number;
    title: string;
    body: string | null;
    author: string;
    mergedAt: string;
    additions?: number;
    deletions?: number;
  }>;
  releases: Array<{ tag: string; name: string | null; body: string | null; publishedAt: string }>;
  linearIssues?: LinearIssue[]; // completed issues in range (when a Linear key is provided)
  notionPages?: NotionPage[]; // docs edited in range (when a Notion token is provided)
  deployments?: VercelDeployment[]; // production deploys in range (Vercel token)
  revenue?: RevenueSnapshot; // founder Stripe metrics (their key)
  figmaFiles?: FigmaFileActivity[]; // design files modified in range (Figma token)
  posthog?: PosthogSnapshot; // product analytics in range (PostHog key)
  webMentions?: WebMention[]; // press/web mentions in range (Linkup, server key)
  googleDocs?: GoogleDriveFile[]; // Drive files edited in range (Google Workspace)
}

export interface GenerateRequest {
  repoUrl: string; // e.g. https://github.com/vercel/ai
  since: string; // ISO date
  until: string; // ISO date
  company?: string; // company/product name; defaults to repo name
  metricsNotes?: string; // founder-pasted or voice-dictated metrics/context
  tone?: "confident" | "humble" | "hype";
  linearApiKey?: string; // optional; used for this request only, never stored or logged
  notionToken?: string; // optional; used for this request only, never stored or logged
  // All source credentials below: per-request only, never stored or logged.
  vercelToken?: string;
  vercelProjectId?: string; // optional narrowing; without it, all projects in scope
  stripeMetricsKey?: string; // the FOUNDER's Stripe secret/restricted key for revenue metrics
  figmaToken?: string;
  figmaTeamId?: string; // required by Figma's API to enumerate projects/files
  googleToken?: string; // Google Workspace: "refresh:<token>" from Connect
  linkedinToken?: string; // LinkedIn member token from Connect (publish only)
  githubToken?: string; // GitHub token from Connect; unlocks private repos + org-wide analysis
  posthogKey?: string; // personal API key
  posthogProjectId?: string;
  posthogHost?: string; // default https://us.posthog.com
}

// ---- Auth & billing contracts ----

// The authenticated user as seen by the app (never carries passwordHash).
export interface SessionUser {
  id: string; // Mongo _id as string — the stable per-user key
  email: string;
  name: string;
}

export type Plan = "free" | "pro";

export interface EntitlementInfo {
  plan: Plan;
  freeGenerationsUsed: number;
  freeGenerationLimit: number;
}

// ---- MongoDB documents (server-side only; never sent to the client raw) ----

import type { ObjectId } from "mongodb";

export interface UserDoc {
  _id?: ObjectId;
  email: string; // stored lowercased, unique
  name: string;
  passwordHash: string;
  stripeCustomerId?: string;
  voiceId?: string; // ElevenLabs cloned voice pinned to this founder
  createdAt: Date;
}

export interface ConnectionDoc {
  _id?: ObjectId;
  userId: string; // owner — every read/write is scoped by this
  provider: string; // linear | notion | figma | vercel | stripe
  encToken: string; // provider token, encrypted at rest (A256GCM)
  createdAt: Date;
}

export interface VideoScene {
  id: string;
  title: string; // short on-screen headline
  bullets: string[]; // up to 3 short on-screen lines
  narration: string; // what the voiceover says during this scene
}

export interface CadenceArtifacts {
  company: string;
  themes: string[]; // 3-5 shipped-work themes extracted by the analyst agent
  investorUpdate: string; // markdown, the hero artifact
  linkedinPost: string; // plain text with line breaks
  xThread: string[]; // array of tweets
  changelog: string; // markdown
  script: {
    durationSeconds: number; // target 60-90
    scenes: VideoScene[]; // 4-6 scenes
  };
  meta: {
    mock: boolean; // true when generated without an LLM key
    model: string;
    commitCount: number;
    prCount: number;
    releaseCount: number;
    cached?: boolean; // true when served from the live-artifact cache after a provider failure
  };
}

// ---- Component prop contracts (cross-feature integration points) ----

// components/voice-note.tsx must export: VoiceNoteButton
export interface VoiceNoteButtonProps {
  onTranscript: (text: string) => void; // appends dictated text to metrics notes
  disabled?: boolean;
}

// components/video-studio.tsx must export: VideoStudio
export interface VideoStudioProps {
  artifacts: CadenceArtifacts;
}
