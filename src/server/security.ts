import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A new admin token: 32 random bytes, base64url encoded (43 characters). */
export function generateAdminToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest of a token. Only the hash is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time check of a presented token against a stored hash. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

/** Random lowercase alphanumeric suffix, used to make slugs unique. */
export function randomSuffix(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
