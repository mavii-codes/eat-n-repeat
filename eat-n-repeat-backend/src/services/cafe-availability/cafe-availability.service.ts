import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";

const HEARTBEAT_FRESHNESS_MS = 3 * 60 * 1000; // 3 minutes
const PROBE_TIMEOUT_MS = 3000;
const PROBE_CACHE_TTL_MS = 45 * 1000; // avoid outbound call per checkout

export type OnlineOrderingMode = "AVAILABLE" | "UNAVAILABLE" | "LOCAL_ONLY";

export interface CafeAvailabilityResult {
  onlineOrdering: OnlineOrderingMode;
  /**
   * Connectivity signal, NOT café→cloud liveness.
   *
   * A successful resolve() proves this backend is alive and reachable by
   * the caller, so it is ALWAYS false here. Café→cloud liveness lives
   * exclusively in `onlineOrdering` (heartbeat freshness / force override).
   * Merging the two previously made healthy local servers report "offline".
   *
   * Kept in the shape for backward compatibility with older clients.
   */
  isOffline: boolean;
  reason?: string;
}

export class CafeAvailabilityService {
  private probeCache: { at: number; reachable: boolean } | null = null;

  /**
   * True when this instance is a café laptop that should phone home
   * (a real cloud URL is configured — not the example placeholder).
   * When false, this instance IS the cloud and uses inbound heartbeats.
   */
  private isCafeInstance(): boolean {
    return Boolean(env.cloudSyncUrl) && !env.cloudSyncUrl.includes("example.com");
  }

  /**
   * Outbound reachability check (café instances only): can this laptop
   * reach the cloud right now? Cached briefly so per-order checkout gates
   * stay fast; fail-closed (unreachable → false).
   */
  private async probeCloud(): Promise<boolean> {
    const now = Date.now();
    if (this.probeCache && now - this.probeCache.at < PROBE_CACHE_TTL_MS) {
      return this.probeCache.reachable;
    }
    let reachable = false;
    try {
      const healthUrl = new URL("/api/health", new URL(env.cloudSyncUrl).origin).toString();
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      reachable = Boolean(res);
    } catch {
      reachable = false;
    }
    this.probeCache = { at: now, reachable };
    return reachable;
  }
  /**
   * Ensure the single-row CafeStatus exists. Called lazily on first access.
   * Uses upsert to be concurrency-safe: two callers racing on an empty
   * table will both succeed without triggering a P2002 duplicate PK.
   */
  private async ensureRow(): Promise<void> {
    await prisma.cafeStatus.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, onlineOrdering: "AVAILABLE", forceOverride: null },
    });
  }

  /**
   * Resolve the current online-ordering availability.
   *
   * Rules:
   *  1. `forceOverride` wins when set → "LOCAL_ONLY" (FORCE_UNAVAILABLE) or "AVAILABLE" (FORCE_AVAILABLE).
   *  2. Café instance (real CLOUD_SYNC_URL): outbound cloud probe.
   *     Reachable → "AVAILABLE", else → "UNAVAILABLE".
   *  2b. Cloud instance never heartbeated (lastHeartbeatAt IS NULL):
   *     standalone mode → "AVAILABLE" (no café exists to be unresponsive).
   *  3. Cloud instance (no real CLOUD_SYNC_URL): inbound heartbeat
   *     freshness; fresh (< 3 min) → "AVAILABLE", else → "UNAVAILABLE".
   *
   * `isOffline` is ALWAYS false here: reaching this code proves the backend
   * is alive for the caller. The frontend decides real offline state from
   * fetch failure / navigator.onLine instead of trusting this flag.
   */
  async resolve(): Promise<CafeAvailabilityResult> {
    await this.ensureRow();

    const row = await prisma.cafeStatus.findUnique({ where: { id: 1 } });
    if (!row) {
      // Should never happen after ensureRow, but be safe.
      return { onlineOrdering: "AVAILABLE", isOffline: false };
    }

    const now = Date.now();

    // 1. Force override
    if (row.forceOverride === "FORCE_UNAVAILABLE") {
      return {
        onlineOrdering: "LOCAL_ONLY",
        isOffline: false,
        reason: "Manually set to unavailable by admin",
      };
    }
    if (row.forceOverride === "FORCE_AVAILABLE") {
      return {
        onlineOrdering: "AVAILABLE",
        isOffline: false,
        reason: "Manually set to available by admin",
      };
    }

    // 2. Café instance — use outbound cloud probe (not inbound heartbeats:
    //    nothing ever heartbeats TO a laptop, so freshness would lie here).
    if (this.isCafeInstance()) {
      const reachable = await this.probeCloud();
      if (reachable) {
        return {
          onlineOrdering: "AVAILABLE",
          isOffline: false,
          reason: "Cloud reachable",
        };
      }
      return {
        onlineOrdering: "UNAVAILABLE",
        isOffline: false,
        reason: "Cannot reach cloud",
      };
    }

    // 2b. Cloud instance with no café ever linked — standalone mode.
    // lastHeartbeatAt IS NULL means no heartbeat sender has ever checked in;
    // there is no café to be "not responding", so don't block online ordering.
    // Once a heartbeat arrives, the freshness logic below applies normally.
    if (!row.lastHeartbeatAt) {
      return {
        onlineOrdering: "AVAILABLE",
        isOffline: false,
        reason: "No cafe linked — cloud standalone mode",
      };
    }

    // 3. Cloud instance — use inbound heartbeat freshness
    const heartbeatFresh =
      row.lastHeartbeatAt &&
      now - row.lastHeartbeatAt.getTime() < HEARTBEAT_FRESHNESS_MS;

    if (heartbeatFresh) {
      return {
        onlineOrdering: "AVAILABLE",
        isOffline: false,
      };
    }

    return {
      onlineOrdering: "UNAVAILABLE",
      isOffline: false,
      reason: "Cafe is not responding to heartbeats",
    };
  }

  /**
   * Admin: set the force override mode.
   */
  async setOverride(mode: "AUTO" | "FORCE_AVAILABLE" | "FORCE_UNAVAILABLE"): Promise<void> {
    await this.ensureRow();

    const forceOverride = mode === "AUTO" ? null : mode;
    await prisma.cafeStatus.update({
      where: { id: 1 },
      data: { forceOverride },
    });
  }

  /**
   * Called by the heartbeat receiver endpoint to record liveness.
   */
  async recordHeartbeat(): Promise<void> {
    await this.ensureRow();

    await prisma.cafeStatus.update({
      where: { id: 1 },
      data: { lastHeartbeatAt: new Date() },
    });
  }
}

export const cafeAvailabilityService = new CafeAvailabilityService();
