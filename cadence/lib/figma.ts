// Figma data layer for Cadence.
// Enumerates a team's projects and their files via the Figma REST API, keeps
// the files modified in the date window, and maps them onto FigmaFileActivity.
//
// The token is used for the single request only — never stored, never logged.

import type { FigmaFileActivity } from "@/lib/types";

const FIGMA_API_BASE = "https://api.figma.com";
const TIMEOUT_MS = 15_000;
const MAX_PROJECTS = 10;
const MAX_FILES = 30;

interface FigmaProjectsResponse {
  projects?: Array<{ id?: string | number; name?: string }>;
}

interface FigmaFilesResponse {
  files?: Array<{ key?: string; name?: string; last_modified?: string }>;
}

/** Normalize a possibly date-only ISO string to a full start-of-day timestamp. */
function toStartOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T00:00:00.000Z` : iso;
}

function toEndOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T23:59:59.999Z` : iso;
}

async function figmaGet<T>(token: string, path: string): Promise<T> {
  let res: Response;
  try {
    // Personal access tokens (figd_...) use the X-Figma-Token header; OAuth
    // access tokens (from one-click Connect) use the standard Bearer scheme.
    const headers: Record<string, string> = token.startsWith("figd_")
      ? { "X-Figma-Token": token }
      : { Authorization: `Bearer ${token}` };
    res = await fetch(`${FIGMA_API_BASE}${path}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Figma API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the Figma API.");
  }

  // Figma reports bad/insufficient tokens as 403 (401 covered for safety).
  if (res.status === 401 || res.status === 403) {
    throw new Error("Figma token was rejected");
  }
  if (res.status === 429) {
    throw new Error("Figma API rate limit hit — try again shortly.");
  }
  if (!res.ok) {
    throw new Error(`Figma API returned HTTP ${res.status}.`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Figma API returned an unreadable response.");
  }
}

export async function fetchFigmaActivity(
  token: string,
  teamId: string,
  since: string,
  until: string
): Promise<FigmaFileActivity[]> {
  const team = await figmaGet<FigmaProjectsResponse>(
    token,
    `/v1/teams/${encodeURIComponent(teamId)}/projects`
  );

  const projects = (team.projects ?? [])
    .filter((project) => project.id !== undefined && project.id !== null)
    .slice(0, MAX_PROJECTS);

  const fileLists = await Promise.all(
    projects.map((project) =>
      figmaGet<FigmaFilesResponse>(token, `/v1/projects/${encodeURIComponent(String(project.id))}/files`)
    )
  );

  const sinceMs = Date.parse(toStartOfDay(since));
  const untilMs = Date.parse(toEndOfDay(until));

  const files: FigmaFileActivity[] = [];
  for (const list of fileLists) {
    for (const file of list.files ?? []) {
      if (!file.key || !file.name || !file.last_modified) continue;
      const modifiedMs = Date.parse(file.last_modified);
      if (Number.isNaN(modifiedMs) || modifiedMs < sinceMs || modifiedMs > untilMs) continue;
      files.push({
        key: file.key,
        name: file.name,
        lastModified: file.last_modified,
        url: `https://www.figma.com/file/${file.key}`,
      });
    }
  }

  return files
    .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
    .slice(0, MAX_FILES);
}
