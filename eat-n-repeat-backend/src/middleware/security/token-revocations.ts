/**
 * In-memory user-token revocation registry.
 *
 * Password changes / forced logouts record a cutoff timestamp. A JWT whose
 * `iat` is at or before that cutoff is considered revoked. This is
 * process-local (single-server deployments); a restart clears revocations.
 */

interface RevocationEntry {
  /**
   * Epoch ms cutoff: tokens issued at or before this instant are revoked.
   * Only advances; a newer revocation supersedes an older cutoff.
   */
  revokedAt: number;
  expiresAt: number;
}

const REVOCATION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const revocations = new Map<string, RevocationEntry>();

function purgeExpired(now: number): void {
  for (const [userId, entry] of revocations) {
    if (entry.expiresAt <= now) revocations.delete(userId);
  }
}

/**
 * Revokes all tokens for `userId` issued at or before the supplied time.
 * The cutoff only ever advances: when multiple revocations exist the later
 * cutoff is retained, so tokens issued between an older event and a newer
 * one are revoked as well.
 */
export function revokeAllForUser(userId: string, when: Date = new Date()): void {
  const now = Date.now();
  purgeExpired(now);

  const requested = when.getTime();
  if (!Number.isFinite(requested)) return;

  const existing = revocations.get(userId);
  const revokedAt = existing ? Math.max(existing.revokedAt, requested) : requested;

  revocations.set(userId, {
    revokedAt,
    expiresAt: now + REVOCATION_TTL_MS,
  });
}

/** Revokes all tokens for `userId` issued at or before now. */
export function revokeUserTokensBeforeNow(userId: string): void {
  revokeAllForUser(userId, new Date());
}

/**
 * True when a revocation is active for `userId` and the token's `iat` is at
 * or before the revocation cutoff. Tokens without an `iat` are not revoked.
 */
export function isTokenRevoked(
  userId: string,
  issuedAtSeconds: number | undefined,
): boolean {
  const now = Date.now();
  const entry = revocations.get(userId);
  if (!entry) return false;

  if (entry.expiresAt <= now) {
    revocations.delete(userId);
    return false;
  }

  if (issuedAtSeconds === undefined || !Number.isFinite(issuedAtSeconds)) {
    return false;
  }

  return issuedAtSeconds * 1000 <= entry.revokedAt;
}
