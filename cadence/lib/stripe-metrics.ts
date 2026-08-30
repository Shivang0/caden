// Stripe revenue metrics for Cadence — the FOUNDER's Stripe account, read
// with the key they paste into the form. Deliberately separate from
// lib/stripe.ts (the app's own billing): plain REST keeps this stateless
// per-request, with no shared SDK client or config to entangle.
//
// The key is used for the single request only — never stored, never logged.

import type { RevenueSnapshot } from "@/lib/types";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 100;

interface StripePrice {
  unit_amount?: number | null;
  currency?: string | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
}

interface StripeSubscriptionItem {
  quantity?: number | null;
  price?: StripePrice | null;
}

interface StripeSubscription {
  items?: { data?: StripeSubscriptionItem[] } | null;
}

interface StripeCharge {
  amount?: number | null;
  status?: string | null;
}

interface StripeListResponse<T> {
  data?: T[];
  has_more?: boolean;
}

function toEpochSeconds(iso: string, endOfDay: boolean): number {
  const stamp = iso.length <= 10 ? `${iso}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : iso;
  return Math.floor(Date.parse(stamp) / 1000);
}

/**
 * Normalize a recurring amount to a monthly figure; null for non-recurring.
 * interval_count matters: "$30 every 3 months" is interval=month, count=3
 * → $10/mo, not $30/mo.
 */
function toMonthlyCents(
  amountCents: number,
  interval: string | null | undefined,
  intervalCount: number | null | undefined
): number | null {
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case "month":
      return amountCents / count;
    case "year":
      return amountCents / (12 * count);
    case "week":
      return (amountCents * 4.33) / count;
    case "day":
      return (amountCents * 30) / count;
    default:
      return null;
  }
}

async function stripeGet<T>(
  apiKey: string,
  path: string,
  params: URLSearchParams
): Promise<StripeListResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`${STRIPE_API_BASE}${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Stripe API request timed out after 15 seconds.");
    }
    throw new Error("Could not reach the Stripe API.");
  }

  if (res.status === 401) {
    throw new Error("Stripe metrics key was rejected");
  }
  if (res.status === 429) {
    throw new Error("Stripe API rate limit hit — try again shortly.");
  }
  if (!res.ok) {
    throw new Error(`Stripe API returned HTTP ${res.status} for ${path}.`);
  }

  try {
    return (await res.json()) as StripeListResponse<T>;
  } catch {
    throw new Error(`Stripe API returned an unreadable response for ${path}.`);
  }
}

// Follow has_more/starting_after up to MAX_PAGES (bounds work on huge accounts).
const MAX_PAGES = 10;

async function stripeGetAll<T extends { id?: string }>(
  apiKey: string,
  path: string,
  baseParams: () => URLSearchParams
): Promise<{ data: T[]; capped: boolean }> {
  const all: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = baseParams();
    if (startingAfter) params.set("starting_after", startingAfter);
    const res = await stripeGet<T>(apiKey, path, params);
    const data = res.data ?? [];
    all.push(...data);
    const lastId = data[data.length - 1]?.id;
    if (!res.has_more || !lastId) return { data: all, capped: false };
    startingAfter = lastId;
  }
  return { data: all, capped: true };
}

export async function fetchRevenueSnapshot(
  apiKey: string,
  since: string,
  until: string
): Promise<RevenueSnapshot> {
  const sinceEpoch = toEpochSeconds(since, false);
  const untilEpoch = toEpochSeconds(until, true);

  const subsParams = () => {
    const params = new URLSearchParams({ status: "active", limit: String(PAGE_LIMIT) });
    params.append("expand[]", "data.items.data.price");
    return params;
  };

  const rangeParams = () => {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    params.set("created[gte]", String(sinceEpoch));
    params.set("created[lte]", String(untilEpoch));
    return params;
  };

  const [subs, customers, charges] = await Promise.all([
    stripeGetAll<StripeSubscription & { id?: string }>(apiKey, "/subscriptions", subsParams),
    stripeGet<unknown>(apiKey, "/customers", rangeParams()),
    stripeGetAll<StripeCharge & { id?: string }>(apiKey, "/charges", rangeParams),
  ]);

  // MRR: sum every active subscription item's price, normalized to monthly.
  const subsData = subs.data;
  let mrr = 0;
  let currency: string | null = null;
  for (const sub of subsData) {
    for (const item of sub.items?.data ?? []) {
      const price = item.price;
      if (!price || price.unit_amount == null) continue;
      if (!currency && price.currency) currency = price.currency;
      const monthly = toMonthlyCents(
        price.unit_amount * (item.quantity ?? 1),
        price.recurring?.interval,
        price.recurring?.interval_count
      );
      if (monthly !== null) mrr += monthly;
    }
  }

  // Customer count stays one page; has_more means "at least 100".
  const newCustomersInRange = customers.has_more
    ? PAGE_LIMIT
    : Math.min((customers.data ?? []).length, PAGE_LIMIT);

  const chargedInRangeCents = charges.data.reduce(
    (sum, charge) =>
      charge.status === "succeeded" && typeof charge.amount === "number"
        ? sum + charge.amount
        : sum,
    0
  );

  return {
    currency,
    mrrCents: subsData.length === 0 ? null : Math.round(mrr),
    activeSubscriptions: subsData.length,
    newCustomersInRange,
    chargedInRangeCents,
  };
}
