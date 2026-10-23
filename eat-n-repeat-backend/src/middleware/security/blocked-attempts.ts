/**
 * Security blocked-attempt logging.
 *
 * Every block is written as one structured console line and kept in a small
 * in-memory ring buffer so future admin UI can surface recent security events.
 * Callers must never pass passwords, raw tokens, request bodies, or headers in
 * `meta`; the sanitizer redacts known sensitive keys as a second line of
 * defence. `blockedAttemptsVersion()` is a lightweight change counter for
 * polling/badge consumers.
 */

export interface BlockedAttempt {
  id: number;
  type: string;
  ip: string | null;
  reason: string;
  /** ISO-8601 timestamp. */
  at: string;
  meta?: Record<string, unknown>;
}

const MAX_RECENT_ATTEMPTS = 500;
const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /password|token|authorization|secret/i;
const MAX_META_DEPTH = 5;
const TRUNCATED = "[truncated]";

const recentAttempts: BlockedAttempt[] = [];
let version = 0;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_META_DEPTH) return TRUNCATED;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeValue(nested, depth + 1);
    }
    return result;
  }

  return value;
}

/**
 * Returns a shallow-copied, recursively sanitized version of a metadata object.
 * Keys containing password/token/authorization/secret (case insensitive) are
 * replaced with `"[redacted]"`.
 */
export function sanitizeBlockedAttemptMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return sanitizeValue(meta, 0) as Record<string, unknown>;
}

/**
 * Records a blocked security attempt. Never pass secrets or request bodies.
 */
export function logBlockedAttempt(
  type: string,
  ip: string | null,
  reason: string,
  meta?: Record<string, unknown>,
): void {
  const at = new Date().toISOString();
  const sanitizedMeta = sanitizeBlockedAttemptMeta(meta);

  version += 1;
  const entry: BlockedAttempt = {
    id: version,
    type,
    ip,
    reason,
    at,
    ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
  };

  recentAttempts.push(entry);
  if (recentAttempts.length > MAX_RECENT_ATTEMPTS) {
    recentAttempts.splice(0, recentAttempts.length - MAX_RECENT_ATTEMPTS);
  }

  const metaJson = JSON.stringify(sanitizedMeta ?? {});
  console.warn(
    `[SECURITY-BLOCK] type=${type} ip=${ip ?? "unknown"} reason=${reason} at=${at} meta=${metaJson}`,
  );
}

/** Most recent blocked attempts, oldest first. */
export function getRecentBlockedAttempts(): BlockedAttempt[] {
  return recentAttempts.map((entry) => ({
    ...entry,
    ...(entry.meta ? { meta: { ...entry.meta } } : {}),
  }));
}

/** Monotonically increasing counter; increments on every logged attempt. */
export function blockedAttemptsVersion(): number {
  return version;
}
