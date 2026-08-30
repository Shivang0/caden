// Linear data layer for Cadence.
// Fetches issues completed in a date window via the Linear GraphQL API and
// maps them onto the shared LinearIssue contract.
//
// The API key is used for the single request only — never stored, never logged.

import type { LinearIssue } from "@/lib/types";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const TIMEOUT_MS = 15_000;
const MAX_ISSUES = 100;

interface LinearIssueNode {
  identifier?: string;
  title?: string;
  completedAt?: string | null;
  assignee?: { name?: string | null } | null;
  project?: { name?: string | null } | null;
}

interface LinearGraphQLResponse {
  data?: { issues?: { nodes?: LinearIssueNode[] } } | null;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

/** Normalize a possibly date-only ISO string to a full start-of-day timestamp. */
function toStartOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T00:00:00.000Z` : iso;
}

function toEndOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T23:59:59.999Z` : iso;
}

function buildQuery(since: string, until: string): string {
  // Values are JSON.stringify-escaped ISO timestamps (already validated as
  // dates upstream), inlined so we don't depend on Linear's evolving scalar
  // names for filter variables. orderBy uses the stable PaginationOrderBy
  // enum; we re-sort by completedAt client-side below.
  return `query {
    issues(
      filter: { completedAt: { gte: ${JSON.stringify(since)}, lte: ${JSON.stringify(until)} } }
      first: ${MAX_ISSUES}
      orderBy: updatedAt
    ) {
      nodes {
        identifier
        title
        completedAt
        assignee { name }
        project { name }
      }
    }
  }`;
}

export async function fetchLinearActivity(
  apiKey: string,
  since: string,
  until: string
): Promise<LinearIssue[]> {
  const query = buildQuery(toStartOfDay(since), toEndOfDay(until));

  let res: Response;
  try {
    res = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        // Linear personal API keys (lin_api_...) are sent raw — NOT
        // "Bearer <key>". OAuth access tokens (from one-click Connect) use
        // the standard Bearer scheme.
        Authorization: apiKey.startsWith("lin_api_") ? apiKey : `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Linear API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the Linear API.");
  }

  if (res.status === 401) {
    throw new Error("Linear API key was rejected");
  }
  if (res.status === 429) {
    throw new Error("Linear API rate limit hit — try again shortly.");
  }

  let body: LinearGraphQLResponse;
  try {
    body = (await res.json()) as LinearGraphQLResponse;
  } catch {
    throw new Error(`Linear API returned an unreadable response (HTTP ${res.status}).`);
  }

  if (body.errors && body.errors.length > 0) {
    const first = body.errors[0];
    const code = first.extensions?.code ?? "";
    if (/authentication/i.test(code) || /authentication/i.test(first.message ?? "")) {
      throw new Error("Linear API key was rejected");
    }
    throw new Error(`Linear API returned an error: ${first.message ?? "unknown GraphQL error"}`);
  }

  if (!res.ok) {
    throw new Error(`Linear API returned HTTP ${res.status}.`);
  }

  const nodes = body.data?.issues?.nodes ?? [];
  return nodes
    .filter((node) => Boolean(node.identifier && node.title && node.completedAt))
    .map<LinearIssue>((node) => ({
      identifier: node.identifier ?? "",
      title: node.title ?? "",
      completedAt: node.completedAt ?? "",
      assignee: node.assignee?.name ?? null,
      project: node.project?.name ?? null,
    }))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}
