// GitHub data layer for Cadence.
// Fetches repo metadata, commits, merged PRs, and releases via the REST API
// and maps them onto the shared RepoActivity contract.

import type { RepoActivity } from "@/lib/types";

const GITHUB_API = "https://api.github.com";
const MAX_COMMITS = 200;
const MAX_PRS = 200;
const PER_PAGE = 100;

// ---- Typed errors so the API route can map to proper HTTP statuses ----

export class InvalidRepoUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRepoUrlError";
  }
}

export class RepoNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepoNotFoundError";
  }
}

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

// ---- Minimal GitHub response shapes (only the fields we read) ----

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  owner: { login: string };
}

interface GhCommit {
  sha: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
    committer: { name?: string; date?: string } | null;
  };
  author: { login: string } | null;
}

interface GhSearchIssueItem {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  closed_at: string | null;
  pull_request?: { merged_at: string | null };
}

interface GhSearchResponse {
  items: GhSearchIssueItem[];
}

interface GhPull {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  merged_at: string | null;
  updated_at?: string;
  additions?: number;
  deletions?: number;
}

interface GhRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  draft: boolean;
}

// ---- Helpers ----

export function parseRepoUrl(repoUrl: string): { owner: string; name: string } {
  const trimmed = repoUrl.trim();
  // Accept: https://github.com/owner/name, http://, no scheme, www., .git suffix,
  // trailing slashes, and extra path segments (/tree/main etc.).
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/
  );
  if (!match) {
    throw new InvalidRepoUrlError(
      `Could not parse "${repoUrl}" as a GitHub repository URL. Expected something like https://github.com/owner/repo.`
    );
  }
  const [, owner, name] = match;
  if (!owner || !name) {
    throw new InvalidRepoUrlError(
      `Could not extract owner/name from "${repoUrl}".`
    );
  }
  return { owner, name };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cadence-app",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function ghFetch(url: string, repoLabel: string): Promise<Response> {
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) {
    throw new RepoNotFoundError(
      `Repository ${repoLabel} was not found on GitHub. Check the URL — private repos require a GITHUB_TOKEN with access.`
    );
  }
  if (res.status === 429) {
    throw new GitHubRateLimitError(
      `GitHub API rate limit hit while fetching ${repoLabel}. Set GITHUB_TOKEN in your environment for a much higher limit, or try again shortly.`
    );
  }
  if (res.status === 403) {
    // 403 is not always a rate limit — it can also mean missing token scopes,
    // SAML SSO enforcement, or IP allowlists. Only tell the user to wait when
    // GitHub actually says the limit is exhausted.
    let detail = "";
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === "string") detail = body.message;
    } catch {
      /* non-JSON body */
    }
    const rateLimited =
      res.headers.get("x-ratelimit-remaining") === "0" ||
      /rate limit|secondary limit|abuse/i.test(detail);
    if (rateLimited) {
      throw new GitHubRateLimitError(
        `GitHub API rate limit hit while fetching ${repoLabel}. Set GITHUB_TOKEN in your environment for a much higher limit, or try again shortly.`
      );
    }
    throw new Error(
      `GitHub returned 403 (forbidden) while fetching ${repoLabel}${detail ? `: ${detail}` : ""}. Check that your GITHUB_TOKEN has access to this repository (scopes / SSO authorization).`
    );
  }
  return res;
}

/** Date-only portion for search qualifiers (merged:YYYY-MM-DD..YYYY-MM-DD). */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Normalize an ISO date (possibly date-only) to a full timestamp for range checks. */
function toStartOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T00:00:00Z` : iso;
}

function toEndOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T23:59:59Z` : iso;
}

function inRange(timestamp: string | null, sinceMs: number, untilMs: number): boolean {
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  return !Number.isNaN(t) && t >= sinceMs && t <= untilMs;
}

// ---- Fetchers ----

async function fetchRepoMeta(owner: string, name: string): Promise<GhRepo> {
  const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}`, `${owner}/${name}`);
  if (!res.ok) {
    throw new Error(
      `GitHub returned ${res.status} while fetching repository metadata for ${owner}/${name}.`
    );
  }
  return (await res.json()) as GhRepo;
}

async function fetchCommits(
  owner: string,
  name: string,
  since: string,
  until: string
): Promise<RepoActivity["commits"]> {
  const commits: RepoActivity["commits"] = [];
  const pages = Math.ceil(MAX_COMMITS / PER_PAGE);

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      since: toStartOfDay(since),
      until: toEndOfDay(until),
      per_page: String(PER_PAGE),
      page: String(page),
    });
    const res = await ghFetch(
      `${GITHUB_API}/repos/${owner}/${name}/commits?${params}`,
      `${owner}/${name}`
    );
    // 409 = empty repository — treat as no commits rather than an error.
    if (res.status === 409) break;
    if (!res.ok) {
      throw new Error(
        `GitHub returned ${res.status} while fetching commits for ${owner}/${name}.`
      );
    }
    const batch = (await res.json()) as GhCommit[];
    for (const c of batch) {
      commits.push({
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login ?? c.commit.author?.name ?? "unknown",
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
      });
    }
    if (batch.length < PER_PAGE || commits.length >= MAX_COMMITS) break;
  }

  return commits.slice(0, MAX_COMMITS);
}

async function fetchMergedPRsViaSearch(
  owner: string,
  name: string,
  since: string,
  until: string
): Promise<RepoActivity["pullRequests"]> {
  const q = `repo:${owner}/${name} is:pr is:merged merged:${dateOnly(since)}..${dateOnly(until)}`;
  const results: RepoActivity["pullRequests"] = [];
  const pages = Math.ceil(MAX_PRS / PER_PAGE);

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      q,
      per_page: String(PER_PAGE),
      page: String(page),
      sort: "updated",
      order: "desc",
    });
    const res = await fetch(`${GITHUB_API}/search/issues?${params}`, {
      headers: githubHeaders(),
    });
    if (!res.ok) {
      // First page failing → caller falls back to the /pulls listing.
      // A later page failing → keep what we already have.
      if (page === 1) throw new Error(`GitHub search returned ${res.status}`);
      break;
    }
    const data = (await res.json()) as GhSearchResponse;
    const items = data.items ?? [];
    for (const item of items) {
      results.push({
        number: item.number,
        title: item.title,
        body: item.body,
        author: item.user?.login ?? "unknown",
        mergedAt: item.pull_request?.merged_at ?? item.closed_at ?? "",
      });
    }
    if (items.length < PER_PAGE || results.length >= MAX_PRS) break;
  }

  return results.slice(0, MAX_PRS);
}

async function fetchMergedPRsViaPulls(
  owner: string,
  name: string,
  since: string,
  until: string
): Promise<RepoActivity["pullRequests"]> {
  const sinceMs = Date.parse(toStartOfDay(since));
  const untilMs = Date.parse(toEndOfDay(until));
  const results: RepoActivity["pullRequests"] = [];
  // Listed by updated desc; merged_at <= updated_at, so once a whole page was
  // last updated before the window starts, no later page can hold an in-window
  // merge. Cap total pages scanned to keep busy repos bounded.
  const maxPages = Math.max(Math.ceil(MAX_PRS / PER_PAGE) * 2, 4);

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: String(PER_PAGE),
      page: String(page),
    });
    const res = await ghFetch(
      `${GITHUB_API}/repos/${owner}/${name}/pulls?${params}`,
      `${owner}/${name}`
    );
    if (!res.ok) {
      if (page === 1) {
        throw new Error(
          `GitHub returned ${res.status} while fetching pull requests for ${owner}/${name}.`
        );
      }
      break;
    }
    const pulls = (await res.json()) as GhPull[];
    for (const p of pulls) {
      if (!inRange(p.merged_at, sinceMs, untilMs)) continue;
      results.push({
        number: p.number,
        title: p.title,
        body: p.body,
        author: p.user?.login ?? "unknown",
        mergedAt: p.merged_at ?? "",
        ...(typeof p.additions === "number" ? { additions: p.additions } : {}),
        ...(typeof p.deletions === "number" ? { deletions: p.deletions } : {}),
      });
    }
    if (pulls.length < PER_PAGE || results.length >= MAX_PRS) break;
    const oldestUpdated = pulls[pulls.length - 1]?.updated_at;
    if (oldestUpdated) {
      const t = Date.parse(oldestUpdated);
      if (!Number.isNaN(t) && t < sinceMs) break;
    }
  }

  return results.slice(0, MAX_PRS);
}

async function fetchReleases(
  owner: string,
  name: string,
  since: string,
  until: string
): Promise<RepoActivity["releases"]> {
  const sinceMs = Date.parse(toStartOfDay(since));
  const untilMs = Date.parse(toEndOfDay(until));
  const res = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${name}/releases?per_page=${PER_PAGE}`,
    `${owner}/${name}`
  );
  if (!res.ok) {
    // Releases are non-critical; degrade gracefully.
    return [];
  }
  const releases = (await res.json()) as GhRelease[];
  return releases
    .filter((r) => !r.draft && inRange(r.published_at, sinceMs, untilMs))
    .map((r) => ({
      tag: r.tag_name,
      name: r.name,
      body: r.body,
      publishedAt: r.published_at ?? "",
    }));
}

// ---- Public API ----

export async function fetchRepoActivity(
  repoUrl: string,
  since: string,
  until: string
): Promise<RepoActivity> {
  const { owner, name } = parseRepoUrl(repoUrl);

  const repo = await fetchRepoMeta(owner, name);

  const [commits, pullRequests, releases] = await Promise.all([
    fetchCommits(owner, name, since, until),
    fetchMergedPRsViaSearch(owner, name, since, until).catch((err: unknown) => {
      // Search can be flaky / separately rate-limited — fall back to /pulls.
      if (err instanceof RepoNotFoundError || err instanceof GitHubRateLimitError) {
        throw err;
      }
      return fetchMergedPRsViaPulls(owner, name, since, until);
    }),
    fetchReleases(owner, name, since, until),
  ]);

  return {
    repo: {
      owner: repo.owner?.login ?? owner,
      name: repo.name ?? name,
      url: repo.html_url ?? `https://github.com/${owner}/${name}`,
      description: repo.description,
    },
    range: { since, until },
    commits,
    pullRequests,
    releases,
  };
}
