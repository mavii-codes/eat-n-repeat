/**
 * In-memory fixed-window rate limiter.
 *
 * Process-local only (single-server deployments); multiple instances each
 * enforce their own counters. The key always includes `req.ip`; callers may
 * append an identifier via `keyFn`. Expired windows are removed
 * opportunistically and each limiter caps its key map at 10k entries to avoid
 * unbounded memory growth.
 */

import type { NextFunction, Request, Response } from "express";
import { logBlockedAttempt } from "./blocked-attempts";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
  skip?: (req: Request) => boolean;
  logType: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MESSAGE = "Too many requests. Please try again later.";
const MAX_TRACKED_KEYS = 10_000;
const SWEEP_INTERVAL = 250;

export function createRateLimiter(
  opts: RateLimiterOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const windowMs = Math.max(1, opts.windowMs);
  const max = Math.max(1, Math.trunc(opts.max));
  const message = opts.message ?? DEFAULT_MESSAGE;
  const windows = new Map<string, WindowEntry>();
  let requestsSinceSweep = 0;

  function sweep(now: number): void {
    for (const [key, entry] of windows) {
      if (now >= entry.resetAt) windows.delete(key);
    }
  }

  function ensureCapacity(now: number): void {
    if (windows.size < MAX_TRACKED_KEYS) return;

    sweep(now);
    while (windows.size >= MAX_TRACKED_KEYS) {
      // Evict the oldest inserted key (Map preserves insertion order).
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  }

  return function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (opts.skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    requestsSinceSweep += 1;
    if (requestsSinceSweep >= SWEEP_INTERVAL || windows.size >= MAX_TRACKED_KEYS) {
      requestsSinceSweep = 0;
      sweep(now);
    }

    const ip = req.ip ?? "unknown";
    let scopedKey = "";
    if (opts.keyFn) {
      try {
        scopedKey = opts.keyFn(req);
      } catch {
        scopedKey = "";
      }
    }
    const key = scopedKey ? `${ip}:${scopedKey}` : ip;

    let entry = windows.get(key);
    if (!entry) {
      ensureCapacity(now);
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
    } else if (now >= entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterMs = Math.max(1, entry.resetAt - now);
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      );

      logBlockedAttempt(opts.logType, req.ip ?? null, "rate_limit_exceeded", {
        method: req.method,
        // Never log the query string (may contain an SSE ?token=).
        path: req.originalUrl.split("?")[0] || req.path,
        retryAfterMs,
      });

      res.status(429).json({ message });
      return;
    }

    next();
  };
}
