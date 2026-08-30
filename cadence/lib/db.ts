// MongoDB connection — a single cached client reused across requests (and
// across HMR reloads in dev), the standard pattern for serverless/Next.js.

import { MongoClient, type Db, type Collection } from "mongodb";

import type { UserDoc, ConnectionDoc } from "@/lib/types";

const DEFAULT_URI = "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "cadence";

let clientPromise: Promise<MongoClient> | null = null;

// Cache the promise on the global object so `next dev` HMR doesn't open a new
// pool on every reload.
const globalForMongo = globalThis as unknown as {
  _cadenceMongo?: Promise<MongoClient>;
};

export function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  if (globalForMongo._cadenceMongo) return globalForMongo._cadenceMongo;
  if (!clientPromise) {
    clientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    }).connect();
    globalForMongo._cadenceMongo = clientPromise;
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(DB_NAME);
}

let indexesEnsured = false;

export async function getUsers(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  const col = db.collection<UserDoc>("users");
  if (!indexesEnsured) {
    indexesEnsured = true;
    // Unique email; case-insensitive via stored-lowercased email field.
    await col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await db
      .collection("connections")
      .createIndex({ userId: 1, provider: 1 }, { unique: true })
      .catch(() => {});
  }
  return col;
}

export async function getConnections(): Promise<Collection<ConnectionDoc>> {
  const db = await getDb();
  return db.collection<ConnectionDoc>("connections");
}
