// GET /api/auth/session — current session + entitlement for the UI.
// Shape: { user: SessionUser | null, entitlement: EntitlementInfo | null }

import { getSession, readUsageCount } from "@/lib/auth";
import { getEntitlement } from "@/lib/stripe";
import type { EntitlementInfo, SessionUser } from "@/lib/types";

export async function GET(request: Request): Promise<Response> {
  const user: SessionUser | null = await getSession(request);
  if (!user) {
    return Response.json({ user: null, entitlement: null });
  }

  const base = await getEntitlement(user);
  const used = await readUsageCount(request);
  const entitlement: EntitlementInfo = {
    ...base,
    // Free-generation usage is tracked in the signed usage cookie (no DB).
    freeGenerationsUsed: Math.min(used, base.freeGenerationLimit),
  };

  return Response.json({ user, entitlement });
}
