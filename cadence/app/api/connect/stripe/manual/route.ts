// POST /api/connect/stripe/manual — store the founder's own Stripe restricted
// key as their Stripe connection. No Connect OAuth needed: the key is
// validated read-only against Stripe, then encrypted at rest per user.
// The key is never logged.

import { getSession } from "@/lib/auth";
import { saveConnection } from "@/lib/connect/store";
import { getEntitlement, isBillingConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });

  if (isBillingConfigured()) {
    const entitlement = await getEntitlement(user);
    if (entitlement.plan !== "pro") {
      return Response.json({ error: "payment_required" }, { status: 402 });
    }
  }

  let key = "";
  try {
    const body = (await request.json()) as { key?: string };
    key = (body.key ?? "").trim();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // One-click mode: no key in the body binds the founder's own account key
  // (this deployment is single-tenant for the founder's company).
  if (!key) key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!/^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$/.test(key)) {
    return Response.json(
      { error: "That does not look like a Stripe key. Use a restricted key (rk_live_...)." },
      { status: 400 }
    );
  }

  // Validate read access without charging anything.
  const check = await fetch("https://api.stripe.com/v1/subscriptions?limit=1", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (check.status === 401 || check.status === 403) {
    return Response.json(
      { error: "Stripe rejected that key. Check it and make sure it can read subscriptions." },
      { status: 400 }
    );
  }
  if (!check.ok) {
    return Response.json({ error: `Stripe validation failed (${check.status}).` }, { status: 502 });
  }

  await saveConnection(user.id, "stripe", key);
  return Response.json({ ok: true });
}
