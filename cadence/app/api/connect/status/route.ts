// GET /api/connect/status — for the signed-in user: which providers are
// configured (env vars present) and which THEY have connected. Also reports
// auth + entitlement so the UI can gate the buttons.

import { getSession } from "@/lib/auth";
import { listConnectedProviders } from "@/lib/connect/store";
import { CONNECT_PROVIDERS } from "@/lib/connect/providers";
import { getEntitlement, isBillingConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  connected: boolean;
  note?: string;
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSession(request);
  const connected = user ? await listConnectedProviders(user.id) : new Set<string>();
  const entitlement = user ? await getEntitlement(user) : null;

  const providers: ProviderStatus[] = CONNECT_PROVIDERS.map((provider) => {
    const status: ProviderStatus = {
      id: provider.id,
      label: provider.label,
      configured: provider.configured(),
      connected: connected.has(provider.id),
    };
    if (provider.note) status.note = provider.note;
    return status;
  });

  return Response.json({
    providers,
    authenticated: Boolean(user),
    plan: entitlement?.plan ?? null,
    // When billing isn't configured, connecting is allowed for any logged-in
    // user (dev convenience); otherwise it requires the pro plan.
    canConnect: Boolean(user) && (!isBillingConfigured() || entitlement?.plan === "pro"),
    billingConfigured: isBillingConfigured(),
  });
}
