// Vercel data layer for Cadence.
// Lists production deployments created in a date window via the Vercel REST
// API (v6) and maps them onto the shared VercelDeployment contract.
//
// The token is used for the single request only — never stored, never logged.

import type { VercelDeployment } from "@/lib/types";

const VERCEL_DEPLOYMENTS_URL = "https://api.vercel.com/v6/deployments";
const TIMEOUT_MS = 15_000;
const MAX_DEPLOYMENTS = 50;

interface VercelDeploymentNode {
  uid?: string;
  id?: string;
  name?: string | null;
  url?: string | null;
  state?: string;
  readyState?: string;
  target?: string | null;
  created?: number;
  createdAt?: number;
}

interface VercelDeploymentsResponse {
  deployments?: VercelDeploymentNode[];
}

/** Normalize a possibly date-only ISO string to a full start-of-day timestamp. */
function toStartOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T00:00:00.000Z` : iso;
}

function toEndOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T23:59:59.999Z` : iso;
}

export async function fetchVercelDeployments(
  token: string,
  since: string,
  until: string,
  projectId?: string
): Promise<VercelDeployment[]> {
  const params = new URLSearchParams({
    limit: String(MAX_DEPLOYMENTS),
    target: "production",
    since: String(Date.parse(toStartOfDay(since))),
    until: String(Date.parse(toEndOfDay(until))),
  });
  if (projectId) params.set("projectId", projectId);

  let res: Response;
  try {
    res = await fetch(`${VERCEL_DEPLOYMENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Vercel API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the Vercel API.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("Vercel token was rejected");
  }
  if (res.status === 429) {
    throw new Error("Vercel API rate limit hit — try again shortly.");
  }
  if (!res.ok) {
    throw new Error(`Vercel API returned HTTP ${res.status}.`);
  }

  let body: VercelDeploymentsResponse;
  try {
    body = (await res.json()) as VercelDeploymentsResponse;
  } catch {
    throw new Error("Vercel API returned an unreadable response.");
  }

  const deployments: VercelDeployment[] = [];
  for (const node of body.deployments ?? []) {
    const id = node.uid ?? node.id;
    const createdMs = node.createdAt ?? node.created;
    if (!id || typeof createdMs !== "number") continue;
    deployments.push({
      id,
      projectName: node.name ?? null,
      url: node.url ?? null,
      state: node.state ?? node.readyState ?? "UNKNOWN",
      target: node.target ?? null,
      createdAt: new Date(createdMs).toISOString(),
    });
  }
  return deployments.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
