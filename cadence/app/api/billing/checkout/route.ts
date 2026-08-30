// POST /api/billing/checkout — create a Stripe Checkout session for the
// pro subscription. Requires a logged-in user.

import { appUrl, getSession } from "@/lib/auth";
import { ensureCustomer, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "login_required" }, { status: 401 });
  }

  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return Response.json({ error: "billing_not_configured" }, { status: 501 });
  }

  // The free trial is granted ONLY to users who enter the promo code — there
  // is no universal trial. We validate the code here (not via a Stripe coupon),
  // so paying users see a clean "SEK 149.00/month" with nothing due today only
  // when the code is absent, and a real N-day trial when it matches.
  let promoCode = "";
  try {
    const body = (await request.json()) as { promoCode?: unknown };
    if (typeof body?.promoCode === "string") promoCode = body.promoCode.trim().toUpperCase();
  } catch {
    /* no body — no code */
  }
  const validCode = (process.env.PROMO_CODE || "SWEYOUNG26").toUpperCase();
  const trialDays = promoCode && promoCode === validCode
    ? Number(process.env.PROMO_TRIAL_DAYS ?? "7")
    : 0;
  // A non-empty code that doesn't match is a user error worth reporting.
  if (promoCode && promoCode !== validCode) {
    return Response.json({ error: "invalid_promo_code" }, { status: 422 });
  }

  try {
    // Bind the checkout to THIS user's own Stripe customer so the resulting
    // subscription is attributable to exactly one account.
    const customerId = await ensureCustomer(user);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId ?? undefined,
      client_reference_id: user.id,
      // Trial ONLY when a valid promo code was supplied; otherwise pay now.
      subscription_data:
        trialDays > 0 ? { trial_period_days: trialDays } : undefined,
      success_url: `${appUrl()}/account?upgraded=1`,
      cancel_url: `${appUrl()}/account?canceled=1`,
    });
    if (!session.url) {
      return Response.json({ error: "checkout_failed" }, { status: 500 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[cadence] Stripe checkout failed:", error);
    return Response.json({ error: "checkout_failed" }, { status: 500 });
  }
}
