// Merge a user's connected-provider tokens into a GenerateRequest.
// Reads ONLY the given user's connections from the DB, and fills a credential
// field only when the request body didn't supply it (an explicit body value
// always wins). Tokens are never logged. userId scoping is what guarantees one
// user's generation can never pull another user's connected accounts.

import { readConnectionToken } from "@/lib/connect/store";
import { CONNECT_PROVIDERS } from "@/lib/connect/providers";
import type { GenerateRequest } from "@/lib/types";

export async function applyConnections(
  userId: string | null,
  req: GenerateRequest
): Promise<GenerateRequest> {
  const merged: GenerateRequest = { ...req };
  if (!userId) return merged;

  const tokens = await Promise.all(
    CONNECT_PROVIDERS.map((provider) =>
      merged[provider.requestField]
        ? Promise.resolve(null) // body wins — skip the DB read entirely
        : readConnectionToken(userId, provider.id)
    )
  );

  CONNECT_PROVIDERS.forEach((provider, i) => {
    const token = tokens[i];
    if (token && !merged[provider.requestField]) {
      merged[provider.requestField] = token;
    }
  });

  return merged;
}
