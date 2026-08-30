// Notion data layer for Cadence.
// Uses the Notion search API to find pages edited in a date window and maps
// them onto the shared NotionPage contract.
//
// The token is used for the single request only — never stored, never logged.

import type { NotionPage } from "@/lib/types";

const NOTION_SEARCH_URL = "https://api.notion.com/v1/search";
const NOTION_VERSION = "2022-06-28";
const TIMEOUT_MS = 15_000;
const PAGE_SIZE = 50;

interface NotionRichText {
  plain_text?: string;
}

interface NotionProperty {
  type?: string;
  title?: NotionRichText[];
}

interface NotionSearchResult {
  object?: string;
  id?: string;
  last_edited_time?: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
  child_page?: { title?: string };
}

interface NotionSearchResponse {
  results?: NotionSearchResult[];
}

function toStartOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T00:00:00.000Z` : iso;
}

function toEndOfDay(iso: string): string {
  return iso.length <= 10 ? `${iso}T23:59:59.999Z` : iso;
}

/** Extract a human title from a Notion page object; "" when untitled. */
function extractTitle(result: NotionSearchResult): string {
  const props = result.properties;
  if (props) {
    // Common shapes: properties.title (plain pages), properties.Name (databases),
    // or any property whose type is "title".
    const candidates = [props.title, props.Name, ...Object.values(props)];
    for (const prop of candidates) {
      if (!prop || prop.type !== "title" || !Array.isArray(prop.title)) continue;
      const text = prop.title
        .map((t) => t.plain_text ?? "")
        .join("")
        .trim();
      if (text) return text;
    }
  }
  return result.child_page?.title?.trim() ?? "";
}

export async function fetchNotionActivity(
  token: string,
  since: string,
  until: string
): Promise<NotionPage[]> {
  let res: Response;
  try {
    res = await fetch(NOTION_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: PAGE_SIZE,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Notion API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the Notion API.");
  }

  if (res.status === 401) {
    throw new Error("Notion token was rejected");
  }
  if (res.status === 429) {
    throw new Error("Notion API rate limit hit — try again shortly.");
  }
  if (!res.ok) {
    throw new Error(`Notion API returned HTTP ${res.status}.`);
  }

  let body: NotionSearchResponse;
  try {
    body = (await res.json()) as NotionSearchResponse;
  } catch {
    throw new Error("Notion API returned an unreadable response.");
  }

  const sinceMs = Date.parse(toStartOfDay(since));
  const untilMs = Date.parse(toEndOfDay(until));

  const pages: NotionPage[] = [];
  for (const result of body.results ?? []) {
    if (result.object !== "page" || !result.id || !result.last_edited_time) continue;
    const editedMs = Date.parse(result.last_edited_time);
    if (Number.isNaN(editedMs) || editedMs < sinceMs || editedMs > untilMs) continue;
    const title = extractTitle(result);
    if (!title) continue; // skip untitled pages
    pages.push({
      id: result.id,
      title,
      lastEditedAt: result.last_edited_time,
      url: result.url ?? `https://www.notion.so/${result.id.replaceAll("-", "")}`,
    });
  }
  return pages;
}
