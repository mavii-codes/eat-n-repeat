import bcrypt from "bcryptjs";

/**
 * Local staff-credential helpers (offline-capable staff auth).
 *
 * Passwords are NEVER stored in plaintext: every write path hashes with
 * bcrypt first. Legacy plaintext values (old localStorage, mock seeds) are
 * recognized by the absence of a bcrypt prefix and migrated on next write.
 */

const BCRYPT_PREFIX = /^\$2[aby]\$/;
const SALT_ROUNDS = 10;

export function isPasswordHash(value: string | undefined): boolean {
  return typeof value === "string" && BCRYPT_PREFIX.test(value);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function ensureHashed(passwordOrHash: string): string {
  if (!passwordOrHash) return passwordOrHash;
  return isPasswordHash(passwordOrHash) ? passwordOrHash : hashPassword(passwordOrHash);
}

export function verifyPassword(input: string, stored: string | undefined): boolean {
  if (!stored) return false;
  if (isPasswordHash(stored)) {
    try {
      return bcrypt.compareSync(input, stored);
    } catch {
      return false;
    }
  }
  // Legacy plaintext (pre-migration local data).
  return input === stored;
}
