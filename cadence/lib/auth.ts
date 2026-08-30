// Hand-rolled session auth for Cadence.
// GitHub OAuth (authorization code flow) → HS256 JWT (jose) in an httpOnly
// cookie. No database — the JWT *is* the session. The same machinery signs
// the anonymous free-generation usage counter cookie.

import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "cadence_session";
export const STATE_COOKIE = "cadence_oauth_state";
export const USAGE_COOKIE = "cadence_usage";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes
const USAGE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** App origin for OAuth redirects and Stripe return URLs (no trailing slash). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

let warnedAboutFallbackSecret = false;

/**
 * Resolve the raw secret material shared by the HS256 signing key and the
 * Connect cookie encryption key. Fails closed in production (a published
 * fallback key would let anyone forge session + usage cookies — instant pro).
 */
function secretMaterial(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production. Generate one with `openssl rand -hex 32`."
    );
  }
  if (!warnedAboutFallbackSecret) {
    console.warn(
      "[cadence] AUTH_SECRET is not set — using an insecure dev-only fallback. Set AUTH_SECRET (openssl rand -hex 32) before deploying."
    );
    warnedAboutFallbackSecret = true;
  }
  return "cadence-insecure-dev-fallback-set-AUTH_SECRET";
}

function authSecret(): Uint8Array {
  return new TextEncoder().encode(secretMaterial());
}

/**
 * 256-bit key for encrypting "Connect account" provider tokens (jose dir +
 * A256GCM needs exactly 32 bytes). Derived by SHA-256 from the same secret
 * material as authSecret(), so it inherits the production fail-closed throw.
 */
export function connectEncryptionKey(): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secretMaterial(), "utf8").digest());
}

// ---- Cookie options ----

export interface SessionCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

function baseCookieOptions(maxAge: number): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function sessionCookieOptions(): SessionCookieOptions {
  return baseCookieOptions(SESSION_MAX_AGE_SECONDS);
}

export function stateCookieOptions(): SessionCookieOptions {
  return baseCookieOptions(STATE_MAX_AGE_SECONDS);
}

export function usageCookieOptions(): SessionCookieOptions {
  return baseCookieOptions(USAGE_MAX_AGE_SECONDS);
}

// ---- Cookie reading (works with a raw Request or the async cookies() store) ----

/** Read a single cookie value from a Request's Cookie header. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

async function cookieValue(request: Request | undefined, name: string): Promise<string | null> {
  if (request) return readCookie(request, name);
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

// ---- Session JWT ----
// The session carries ONLY the userId (sub). The user record is the source of
// truth, resolved from MongoDB on every request — so a session can never carry
// stale identity, and one browser's cookie can only ever resolve to its own
// user. Email/name in the token are display hints, re-checked against the DB.

export async function createSessionJwt(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());
}

/** The verified userId from the session cookie, or null. Cheap (no DB hit). */
export async function getSessionUserId(request?: Request): Promise<string | null> {
  try {
    const token = await cookieValue(request, SESSION_COOKIE);
    if (!token) return null;
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current user from the session cookie against the DB, or null.
 * DB-backed so identity is always fresh and strictly per-session. Import is
 * done lazily to keep this module usable in edge-ish contexts that never call it.
 */
export async function getSession(request?: Request): Promise<SessionUser | null> {
  const userId = await getSessionUserId(request);
  if (!userId) return null;
  const { getSessionUserById } = await import("@/lib/users");
  return getSessionUserById(userId);
}

// ---- Free-generation usage counter (signed cookie, no DB) ----

export async function createUsageJwt(count: number): Promise<string> {
  return new SignJWT({ count })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret());
}

/** Verified generation count from the usage cookie; 0 on any failure. */
export async function readUsageCount(request?: Request): Promise<number> {
  try {
    const token = await cookieValue(request, USAGE_COOKIE);
    if (!token) return 0;
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    const count = payload.count;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return 0;
    return Math.floor(count);
  } catch {
    return 0;
  }
}
