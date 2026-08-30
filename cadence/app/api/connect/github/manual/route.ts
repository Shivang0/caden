// POST /api/connect/github/manual — one-click GitHub connect. With no token in
// the body, binds the deployment's own GITHUB_TOKEN (single-tenant for the
// founder's org); a pasted PAT overrides it. Validated read-only against the
// GitHub API, then encrypted at rest per user. The token is never logged.

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

  let token = "";
  try {
    const body = (await request.json()) as { token?: string };
    token = (body.token ?? "").trim();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!token) token = process.env.GITHUB_TOKEN ?? "";
  if (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{10,}$/.test(token)) {
    return Response.json(
      { error: "That does not look like a GitHub token (ghp_..., gho_..., or github_pat_...)." },
      { status: 400 }
    );
  }

  // Validate read access without touching anything.
  const check = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "caden-connect",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (check.status === 401 || check.status === 403) {
    return Response.json(
      { error: "GitHub rejected that token. Check it has repo read access." },
      { status: 400 }
    );
  }
  if (!check.ok) {
    return Response.json({ error: `GitHub validation failed (${check.status}).` }, { status: 502 });
  }

  const profile = (await check.json()) as { login?: string };
  await saveConnection(user.id, "github", token);
  return Response.json({ ok: true, login: profile.login ?? "" });
}
