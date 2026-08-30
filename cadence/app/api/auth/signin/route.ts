// POST /api/auth/signin — verify email/password and start a session.

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionJwt, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { verifyCredentials } from "@/lib/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid login details." },
      { status: 400 }
    );
  }

  try {
    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    // Same message for wrong email and wrong password — no account enumeration.
    if (!user) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    const jwt = await createSessionJwt(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("[cadence] signin failed:", err);
    return Response.json({ error: "Could not sign you in. Try again." }, { status: 500 });
  }
}
