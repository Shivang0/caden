// Per-user connection store — provider access tokens live in MongoDB, keyed by
// userId, and encrypted at rest (jose dir + A256GCM with the auth-derived key).
// Every read/write is scoped by userId, so one user can never see or mutate
// another's connections. This replaces the old per-browser cookie storage.

import { EncryptJWT, jwtDecrypt } from "jose";

import { connectEncryptionKey } from "@/lib/auth";
import { getConnections } from "@/lib/db";
import type { ConnectProviderId } from "@/lib/connect/providers";

async function seal(token: string): Promise<string> {
  return new EncryptJWT({ t: token })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .encrypt(connectEncryptionKey());
}

async function unseal(sealed: string): Promise<string | null> {
  try {
    const { payload } = await jwtDecrypt(sealed, connectEncryptionKey());
    return typeof payload.t === "string" && payload.t.length > 0 ? payload.t : null;
  } catch {
    return null;
  }
}

/** Upsert a provider connection for a user (encrypting the token at rest). */
export async function saveConnection(
  userId: string,
  provider: ConnectProviderId,
  token: string
): Promise<void> {
  const col = await getConnections();
  const encToken = await seal(token);
  await col.updateOne(
    { userId, provider },
    { $set: { userId, provider, encToken, createdAt: new Date() } },
    { upsert: true }
  );
}

/** Decrypted token for one of THIS user's connections, or null. */
export async function readConnectionToken(
  userId: string,
  provider: ConnectProviderId
): Promise<string | null> {
  const col = await getConnections();
  const doc = await col.findOne({ userId, provider });
  if (!doc) return null;
  return unseal(doc.encToken);
}

/** The set of providers THIS user has connected. */
export async function listConnectedProviders(userId: string): Promise<Set<string>> {
  const col = await getConnections();
  const docs = await col.find({ userId }, { projection: { provider: 1 } }).toArray();
  return new Set(docs.map((d) => d.provider));
}

/** Remove one of THIS user's connections. */
export async function deleteConnection(
  userId: string,
  provider: ConnectProviderId
): Promise<void> {
  const col = await getConnections();
  await col.deleteOne({ userId, provider });
}
