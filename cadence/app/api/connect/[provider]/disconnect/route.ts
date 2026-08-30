// POST /api/connect/[provider]/disconnect — forget a connection by deleting
// its encrypted cookie. The token lives nowhere else, so this is a full revoke
// on our side (the grant itself can be revoked in the provider's settings).
//
// CSRF: a cross-site form could otherwise force-delete a victim's connection
// cookies, so require same-origin via Sec-Fetch-Site (modern browsers) or an
// Origin match as fallback.

import { NextResponse } from "next/server";

import { appUrl, getSession } from "@/lib/auth";
import { deleteConnection } from "@/lib/connect/store";
import { getProvider } from "@/lib/connect/providers";

export const runtime = "nodejs";

function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "none";
  }
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client (curl) — no CSRF surface
  try {
    return new URL(origin).origin === new URL(appUrl()).origin;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) {
    return Response.json({ error: "unknown_provider" }, { status: 404 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "cross_origin_request_rejected" }, { status: 403 });
  }

  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "login_required" }, { status: 401 });
  }

  // Scoped to THIS user — cannot delete anyone else's connection.
  await deleteConnection(user.id, provider.id);
  return NextResponse.json({ ok: true });
}
