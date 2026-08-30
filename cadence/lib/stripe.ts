// Stripe billing layer for Cadence.
// Per-user entitlement: each user has a Stripe customer (stored on the user
// doc); an active subscription on that customer → "pro". With no
// STRIPE_SECRET_KEY, billing is disabled and everyone is "free".

import Stripe from "stripe";

import { setStripeCustomerId } from "@/lib/users";
import type { EntitlementInfo, SessionUser, UserDoc } from "@/lib/types";

export const FREE_GENERATION_LIMIT = 1;

let client: Stripe | null = null;

/** Lazily constructed Stripe client; null when billing is not configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

/** True only when Stripe is configured AND a subscription price exists. */
export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

function freeEntitlement(): EntitlementInfo {
  return { plan: "free", freeGenerationsUsed: 0, freeGenerationLimit: FREE_GENERATION_LIMIT };
}

function proEntitlement(): EntitlementInfo {
  return { plan: "pro", freeGenerationsUsed: 0, freeGenerationLimit: FREE_GENERATION_LIMIT };
}

interface CacheEntry {
  info: EntitlementInfo;
  expiresAt: number;
}

// Cache keyed by userId — never by email — so entitlement is strictly per-user.
const entitlementCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/**
 * Ensure the user has a Stripe customer, creating one (keyed to their userId in
 * metadata) if needed and persisting the id back to the user doc.
 */
export async function ensureCustomer(user: SessionUser): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const existing = await getStoredCustomerId(user.id);
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { cadenceUserId: user.id },
  });
  await setStripeCustomerId(user.id, customer.id);
  return customer.id;
}

async function getStoredCustomerId(userId: string): Promise<string | undefined> {
  const { findUserById } = await import("@/lib/users");
  const doc = (await findUserById(userId)) as UserDoc | null;
  return doc?.stripeCustomerId;
}

/**
 * Resolve the plan for a user. Reads the user's own Stripe customer only, so
 * there is no cross-user leakage. Failures degrade to "free". Cached 30s.
 */
export async function getEntitlement(user: SessionUser): Promise<EntitlementInfo> {
  const stripe = getStripe();
  if (!stripe) return freeEntitlement();

  const cached = entitlementCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.info };
  }

  let info = freeEntitlement();
  try {
    const customerId = await getStoredCustomerId(user.id);
    if (customerId) {
      // A promo-code checkout starts the subscription in "trialing", which is
      // just as paid as "active" for entitlement purposes.
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 5,
      });
      if (subs.data.some((s) => s.status === "active" || s.status === "trialing")) {
        info = proEntitlement();
      }
    }
  } catch (error) {
    console.error("[cadence] Stripe entitlement lookup failed:", error);
  }

  entitlementCache.set(user.id, { info, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...info };
}

/** Force-refresh entitlement (e.g. right after a successful checkout). */
export function invalidateEntitlement(userId: string): void {
  entitlementCache.delete(userId);
}

/** Convenience: is this user on the pro plan right now? */
export async function isPro(user: SessionUser): Promise<boolean> {
  const ent = await getEntitlement(user);
  return ent.plan === "pro";
}
