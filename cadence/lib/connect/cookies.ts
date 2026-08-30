// Ephemeral CSRF-state cookies for the Connect OAuth dance.
// The per-provider `cadence_conn_state_<id>` cookie holds a random value that
// the provider echoes back and the callback verifies. It is short-lived and
// browser-scoped — the connection TOKENS themselves live in MongoDB keyed by
// userId (see lib/connect/store.ts), never in a cookie.

import type { NextResponse } from "next/server";

import type { ConnectProviderId } from "@/lib/connect/providers";

const STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

/** Per-provider CSRF state cookie name for the Connect OAuth dance. */
export function connectStateCookieName(id: ConnectProviderId): string {
  return `cadence_conn_state_${id}`;
}

interface ConnectCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

export function connectStateCookieOptions(): ConnectCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  };
}

export function clearConnectStateCookie(response: NextResponse, id: ConnectProviderId): void {
  response.cookies.set(connectStateCookieName(id), "", {
    ...connectStateCookieOptions(),
    maxAge: 0,
  });
}
