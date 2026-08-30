// PostHog data layer for Cadence.
// Runs one HogQL aggregate over the events table for the date window and maps
// the result onto PosthogSnapshot. PostHog deployments vary in query-API
// shape, so anything that isn't clearly a count pair degrades to a null
// snapshot instead of failing the source — only auth failures throw.
//
// The key is used for the single request only — never stored, never logged.

import type { PosthogSnapshot } from "@/lib/types";

const DEFAULT_HOST = "https://us.posthog.com";
const TIMEOUT_MS = 15_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface PosthogQueryResponse {
  results?: unknown;
}

function emptySnapshot(): PosthogSnapshot {
  return { eventsInRange: null, activeUsersInRange: null };
}

function toCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchPosthogSnapshot(
  apiKey: string,
  projectId: string,
  since: string,
  until: string,
  host?: string
): Promise<PosthogSnapshot> {
  // Dates are interpolated into HogQL — accept only plain YYYY-MM-DD.
  const sinceDate = since.slice(0, 10);
  const untilDate = until.slice(0, 10);
  if (!ISO_DATE.test(sinceDate) || !ISO_DATE.test(untilDate)) {
    throw new Error("PostHog query dates must be ISO dates (YYYY-MM-DD).");
  }

  // SSRF guard: the host comes from the request body, so only https PostHog
  // cloud hosts are allowed — never arbitrary URLs (metadata endpoints,
  // internal services).
  const rawHost = host?.trim() || DEFAULT_HOST;
  let base: string;
  try {
    const parsed = new URL(rawHost);
    if (parsed.protocol !== "https:" || !/(^|\.)posthog\.com$/.test(parsed.hostname)) {
      throw new Error("bad host");
    }
    base = parsed.origin;
  } catch {
    throw new Error(
      "posthogHost must be an https PostHog cloud host (e.g. https://eu.posthog.com)."
    );
  }
  const hogql =
    `SELECT count(), count(DISTINCT person_id) FROM events ` +
    `WHERE timestamp >= toDateTime('${sinceDate} 00:00:00') ` +
    `AND timestamp <= toDateTime('${untilDate} 23:59:59')`;

  let res: Response;
  try {
    res = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("PostHog API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the PostHog API.");
  }

  if (res.status === 401) {
    throw new Error("PostHog key was rejected");
  }

  // Query-shape/API-variance errors (bad request, unknown project, etc.)
  // degrade to a null snapshot rather than failing the whole source.
  if (!res.ok) {
    return emptySnapshot();
  }

  let body: PosthogQueryResponse;
  try {
    body = (await res.json()) as PosthogQueryResponse;
  } catch {
    return emptySnapshot();
  }

  const rows = Array.isArray(body.results) ? body.results : null;
  const first = rows && rows.length > 0 ? rows[0] : null;
  if (!Array.isArray(first)) {
    return emptySnapshot();
  }

  return {
    eventsInRange: toCount(first[0]),
    activeUsersInRange: toCount(first[1]),
  };
}
