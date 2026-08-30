// User store — email/password accounts in MongoDB. Passwords are bcrypt-hashed;
// the plaintext never leaves this module and the hash never leaves the server.

import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

import { getUsers } from "@/lib/db";
import type { SessionUser, UserDoc } from "@/lib/types";

const BCRYPT_ROUNDS = 10;

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

function toSessionUser(doc: UserDoc): SessionUser {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<SessionUser> {
  const users = await getUsers();
  const normalized = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const doc: UserDoc = {
    email: normalized,
    name: name.trim() || normalized.split("@")[0],
    passwordHash,
    createdAt: new Date(),
  };
  try {
    const res = await users.insertOne(doc);
    return toSessionUser({ ...doc, _id: res.insertedId });
  } catch (err: unknown) {
    // Duplicate key (unique email index) → friendly error.
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new EmailTakenError();
    }
    throw err;
  }
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const users = await getUsers();
  const doc = await users.findOne({ email: normalizeEmail(email) });
  if (!doc) {
    // Constant-ish time: still run a bcrypt compare against a dummy hash so
    // response timing doesn't reveal whether the email exists.
    await bcrypt.compare(password, "$2a$10$" + "x".repeat(53)).catch(() => false);
    return null;
  }
  const ok = await bcrypt.compare(password, doc.passwordHash);
  return ok ? toSessionUser(doc) : null;
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const users = await getUsers();
  return users.findOne({ _id: new ObjectId(id) });
}

export async function getSessionUserById(id: string): Promise<SessionUser | null> {
  const doc = await findUserById(id);
  return doc ? toSessionUser(doc) : null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  const users = await getUsers();
  await users.updateOne({ _id: new ObjectId(userId) }, { $set: { stripeCustomerId: customerId } });
}

/** Pin the founder's cloned ElevenLabs voice to their profile. */
export async function setVoiceId(userId: string, voiceId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  const users = await getUsers();
  await users.updateOne({ _id: new ObjectId(userId) }, { $set: { voiceId } });
}
