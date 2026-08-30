// GET /api/connect/[provider]/callback — provider redirects here after the
// consent screen. Verify state, exchange the code for an access token, seal it
// into the encrypted connection cookie, and land back on the homepage.
//
// Failures redirect to /?connect_error=<id> with NO details in the URL; the
// server log gets a short reason code that never contains the code or token.

import { NextResponse } from "next/server";

import { appUrl, getSession, readCookie } from "@/lib/auth";
import { clearConnectStateCookie, connectStateCookieName } from "@/lib/connect/cookies";
import { saveConnection } from "@/lib/connect/store";
import { getProvider, type ConnectProvider } from "@/lib/connect/providers";
import { isBillingConfigured, isPro } from "@/lib/stripe";

export const runtime = "nodejs";

function failRedirect(provider: ConnectProvider, reason: string): Response {
  // Reason codes only — never the authorization code, token, or query string.
  console.error(`[cadence] connect callback failed (${provider.id}): ${reason}`);
  // The reason code is safe to surface (short machine codes by construction),
  // and turns "it broke" bug reports into "token_exchange_failed_http_401".
  // Land on /connections, which renders the error banner (the home path with
  // a trailing slash also 404s through the demo-web rewrite).
  const response = NextResponse.redirect(
    `${appUrl()}/connections?connect_error=${encodeURIComponent(provider.id)}&reason=${encodeURIComponent(
      reason.slice(0, 60)
    )}`
  );
  clearConnectStateCookie(response, provider.id);
  return response;
}

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
    return failRedirect(provider, "not_configured");
  }

  // The connection is stored against the signed-in user — no session, no store.
  const user = await getSession(request);
  if (!user) {
    return NextResponse.redirect(`${appUrl()}/login?next=/connections`);
  }
  // Enforce the paywall HERE too, not just on /start — a free user could
  // otherwise drive the callback directly to bank a pro-only connection.
  if (isBillingConfigured() && !(await isPro(user))) {
    return NextResponse.redirect(`${appUrl()}/account?upgrade=1`);
  }

  const url = new URL(request.url);

  // User denied the consent screen (or the provider reported an error).
  if (url.searchParams.get("error")) {
    return failRedirect(provider, "provider_error");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = readCookie(request, connectStateCookieName(provider.id));
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return failRedirect(provider, "state_mismatch");
  }

  try {
    const redirectUri = `${appUrl()}/api/connect/${provider.id}/callback`;
    const token = await provider.exchangeCode(code, redirectUri);

    // Store against THIS user only (encrypted at rest in MongoDB).
    await saveConnection(user.id, provider.id, token);
    const response = NextResponse.redirect(
      `${appUrl()}/connections?connected=${encodeURIComponent(provider.id)}`
    );
    clearConnectStateCookie(response, provider.id);
    return response;
  } catch (error) {
    // exchangeCode throws short reason codes that never include secrets.
    return failRedirect(
      provider,
      error instanceof Error ? error.message : "token_exchange_failed"
    );
  }
}
