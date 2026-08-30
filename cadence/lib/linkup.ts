// Press & web mentions via Linkup (https://linkup.so) — server-side key
// (LINKUP_API_KEY), so every generation gets mention tracking with zero user
// setup. Same conventions as the other sources: 15s timeout, descriptive
// errors, never log the key.

import type { WebMention } from "@/lib/types";

const TIMEOUT_MS = 15_000;
const MAX_MENTIONS = 8;

interface LinkupResult {
  type?: string;
  name?: string;
  url?: string;
  content?: string;
}

export async function fetchWebMentions(
  query: string,
  since: string,
  until: string
): Promise<WebMention[]> {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) return [];

  let res: Response;
  try {
    res = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `"${query}" news OR launch OR review OR mention`,
        depth: "standard",
        outputType: "searchResults",
        fromDate: since,
        toDate: until,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Linkup search timed out after 15s");
    }
    throw new Error("Linkup was unreachable");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("Linkup API key was rejected");
  }
  if (res.status === 429) {
    throw new Error("Linkup rate limit reached");
  }
  if (!res.ok) {
    throw new Error(`Linkup returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as { results?: LinkupResult[] };
  if (!Array.isArray(data.results)) return [];

  return data.results
    .filter((r) => (r.type === undefined || r.type === "text") && r.name && r.url)
    .slice(0, MAX_MENTIONS)
    .map((r) => ({
      title: String(r.name).slice(0, 200),
      url: String(r.url),
      snippet: String(r.content ?? "").slice(0, 300),
    }));
}
