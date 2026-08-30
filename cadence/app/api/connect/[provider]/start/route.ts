// GET /api/connect/[provider]/start — kick off the provider's OAuth flow.
// Requires a logged-in user on the PRO plan: only paid, authenticated users
// may connect accounts. Random state in a short-lived httpOnly cookie, then a
// full-page redirect to the provider's authorize URL.

import { NextResponse } from "next/server";

import { appUrl, getSession } from "@/lib/auth";
import { connectStateCookieName, connectStateCookieOptions } from "@/lib/connect/cookies";
import { getProvider } from "@/lib/connect/providers";
import { isBillingConfigured, isPro } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) {
    return Response.json({ error: "unknown_provider" }, { status: 404 });
  }
  if (!provider.configured()) {
    return Response.json({ error: "provider_not_configured" }, { status: 501 });
  }

  // Gate 1: must be signed in.
  const user = await getSession(request);
  if (!user) {
    return NextResponse.redirect(`${appUrl()}/login?next=/connections`);
  }
  // Gate 2: must be on the pro plan (skipped only when billing isn't configured
  // at all, so local dev without Stripe still works).
  if (isBillingConfigured() && !(await isPro(user))) {
    return NextResponse.redirect(`${appUrl()}/account?upgrade=1`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${appUrl()}/api/connect/${provider.id}/callback`;

  const response = NextResponse.redirect(provider.authorizeUrl(state, redirectUri));
  response.cookies.set(connectStateCookieName(provider.id), state, connectStateCookieOptions());
  return response;
}
