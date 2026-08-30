// POST /api/billing/portal — open the Stripe billing portal for the current
// user's customer record. Requires a logged-in user with a Stripe customer.

import { appUrl, getSession } from "@/lib/auth";
import { ensureCustomer, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "login_required" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "billing_not_configured" }, { status: 501 });
  }

  try {
    // Resolve THIS user's own customer only.
    const customerId = await ensureCustomer(user);
    if (!customerId) {
      return Response.json({ error: "no_customer" }, { status: 404 });
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/account`,
    });
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error("[cadence] Stripe portal failed:", error);
    return Response.json({ error: "portal_failed" }, { status: 500 });
  }
}
