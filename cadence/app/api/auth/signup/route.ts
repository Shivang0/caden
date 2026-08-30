// POST /api/auth/signup — create an email/password account and start a session.

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionJwt, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { createUser, EmailTakenError } from "@/lib/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email.").max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  name: z.string().max(120).optional(),
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
      { error: parsed.error.issues[0]?.message ?? "Invalid signup details." },
      { status: 400 }
    );
  }

  try {
    const user = await createUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name ?? ""
    );
    const jwt = await createSessionJwt(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error("[cadence] signup failed:", err);
    return Response.json({ error: "Could not create your account. Try again." }, { status: 500 });
  }
}
