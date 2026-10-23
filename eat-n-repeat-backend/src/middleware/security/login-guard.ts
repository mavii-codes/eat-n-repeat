/**
 * In-memory login lockout store.
 *
 * Failures are tracked per account (`kind:ip:identifier`) and per IP
 * (`kind:ip`). Either bucket reaching RATE_LIMIT_LOGIN_MAX_FAILURES within
 * RATE_LIMIT_LOGIN_LOCK_MINUTES locks the login attempt. This is process-local
 * (single-server deployments).
 */

import { env } from "@/config/env";

export interface LoginGuardMeta {
  attemptsLeft: number;
  /** Epoch milliseconds at which the lock clears, or null when not locked. */
  lockedUntil: number | null;
}

const MAX_TRACKED_KEYS = 10_000;
const SWEEP_INTERVAL = 500;

/** key -> ascending failure timestamps (epoch ms). */
const failureStore = new Map<string, number[]>();
let operationsSinceSweep = 0;

function maxFailures(): number {
  return Math.max(1, Math.trunc(env.rateLimits.loginMaxFailures));
}

function windowMs(): number {
  return Math.max(1, Math.trunc(env.rateLimits.loginLockMinutes)) * 60_000;
}

function accountKey(kind: string, ip: string, identifier: string): string {
  return `${kind}:${ip}:${identifier}`;
}

function ipKey(kind: string, ip: string): string {
  return `${kind}:${ip}`;
}

function pruneExpiredEntries(now: number): void {
  const cutoff = now - windowMs();
  for (const [key, times] of failureStore) {
    let expired = 0;
    while (expired < times.length && times[expired] <= cutoff) expired += 1;
    if (expired > 0) times.splice(0, expired);
    if (times.length === 0) failureStore.delete(key);
  }
}

function maybeSweep(now: number): void {
  operationsSinceSweep += 1;
  if (operationsSinceSweep >= SWEEP_INTERVAL || failureStore.size >= MAX_TRACKED_KEYS) {
    operationsSinceSweep = 0;
    pruneExpiredEntries(now);
  }
}

function ensureCapacity(now: number): void {
  if (failureStore.size < MAX_TRACKED_KEYS) return;

  pruneExpiredEntries(now);
  while (failureStore.size >= MAX_TRACKED_KEYS) {
    // Evict the oldest inserted key (Map preserves insertion order).
    const oldest = failureStore.keys().next();
    if (oldest.done) break;
    failureStore.delete(oldest.value);
  }
}

/** Returns active failures for a key, pruning aged-out timestamps. */
function activeFailures(key: string, now: number): number[] {
  const times = failureStore.get(key);
  if (!times) return [];

  const cutoff = now - windowMs();
  let expired = 0;
  while (expired < times.length && times[expired] <= cutoff) expired += 1;
  if (expired > 0) times.splice(0, expired);

  if (times.length === 0) {
    failureStore.delete(key);
    return [];
  }
  return times;
}

function recordFailure(key: string, now: number): void {
  const existing = failureStore.get(key);
  if (existing) {
    existing.push(now);
    return;
  }

  ensureCapacity(now);
  failureStore.set(key, [now]);
}

/** Records one failed login against both the account and the source IP. */
export function registerLoginFailure(
  kind: string,
  ip: string,
  identifier: string,
): void {
  const now = Date.now();
  maybeSweep(now);
  recordFailure(accountKey(kind, ip, identifier), now);
  recordFailure(ipKey(kind, ip), now);
}

/** True when the account or its source IP has reached the failure threshold. */
export function isLoginLocked(
  kind: string,
  ip: string,
  identifier: string,
): boolean {
  const now = Date.now();
  const max = maxFailures();

  const accountFailures = activeFailures(accountKey(kind, ip, identifier), now).length;
  const ipFailures = activeFailures(ipKey(kind, ip), now).length;

  return accountFailures >= max || ipFailures >= max;
}

/** Clears failures after a successful login. */
export function clearLoginFailures(
  kind: string,
  ip: string,
  identifier: string,
): void {
  failureStore.delete(accountKey(kind, ip, identifier));
  failureStore.delete(ipKey(kind, ip));
}

/** Snapshot for tests / UI: attempts remaining and epoch-ms unlock time. */
export function loginGuardMeta(
  kind: string,
  ip: string,
  identifier: string,
): LoginGuardMeta {
  const now = Date.now();
  const max = maxFailures();
  const window = windowMs();

  const accountFailures = activeFailures(accountKey(kind, ip, identifier), now);
  const ipFailures = activeFailures(ipKey(kind, ip), now);

  const attemptsUsed = Math.max(accountFailures.length, ipFailures.length);
  const attemptsLeft = Math.max(0, max - attemptsUsed);

  const releaseTime = (times: number[]): number | null => {
    if (times.length < max) return null;
    // Once enough oldest failures age out, the count drops below max.
    return times[times.length - max] + window;
  };

  const releases = [releaseTime(accountFailures), releaseTime(ipFailures)].filter(
    (value): value is number => value !== null,
  );

  return {
    attemptsLeft,
    lockedUntil: releases.length > 0 ? Math.max(...releases) : null,
  };
}
