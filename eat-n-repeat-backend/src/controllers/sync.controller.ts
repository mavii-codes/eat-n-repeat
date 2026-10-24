import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { env } from "@/config/env";
import * as service from "@/services/sync";
import { menuPullService } from "@/services/menu-pull";
import { cafeAvailabilityService } from "@/services/cafe-availability";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";

let warnedInsecureHeartbeat = false;
let warnedUnconfiguredHeartbeat = false;

/** Sections a customer token may never replay (staff-only side effects). */
const CUSTOMER_DROPPED_SECTIONS = [
  "offline_payments",
  "offline_status_changes",
  "offline_shifts",
  "offline_stock_transactions",
] as const;

export class SyncController {  async getStatus(_req: Request, res: Response) {
    // NOTE: no try/catch omission here is intentional-looking but was a crash
    // path: Express 4 does not catch async rejections, so a DB outage would
    // take down the process instead of returning 503.
    try {
      const result = await service.getSyncStatus();
      return res.json(result);
    } catch (err) {
      console.error("Sync Status Error:", err);
      return res.status(503).json({ success: false, error: "Sync status unavailable" });
    }
  }

  async push(req: Request, res: Response) {
    try {
      const { orders, payments, customers, staff_notifications } = req.body;
      await service.pushSync({ orders, payments, customers, staff_notifications });
      return res.json({ success: true, message: "Sync successful" });
    } catch (err) {
      console.error("Sync Error:", err);
      return res.status(500).json({ success: false, error: "Sync failed" });
    }
  }

  async offline(req: AuthenticatedRequest, res: Response) {
    try {
      const auth = req.auth;
      const drainingUserId = auth?.userId ?? null;

      // Invariant: Customer accounts cannot sync offline data. Offline mode is for walk-in operations only.
      if (auth?.kind === "customer") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Customer accounts cannot sync offline data. Offline mode is for walk-in café operations only.",
        });
      }

      const syncSecretHeader = req.headers["x-sync-secret"];
      const hasValidSecret = Boolean(
        env.syncSharedSecret && typeof syncSecretHeader === "string" && syncSecretHeader === env.syncSharedSecret,
      );
      const isStaffOrAdmin = auth?.kind === "user" && auth.role && ["admin", "staff"].includes(auth.role);

      if (!isStaffOrAdmin && !hasValidSecret) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Staff credentials or valid server-to-server sync secret required.",
        });
      }

      const {
        offline_orders,
        offline_stock_transactions,
        offline_payments,
        offline_expenses,
        offline_status_changes,
        offline_shifts,
      } = req.body;

      await service.offlineSync(
        {
          offline_orders,
          offline_stock_transactions,
          offline_payments,
          offline_expenses,
          offline_status_changes,
          offline_shifts,
        },
        drainingUserId,
      );
      return res.json({ success: true, message: "Offline Sync successful" });
    } catch (err) {
      console.error("Offline Sync Error:", err);
      return res.status(500).json({ success: false, error: "Offline Sync failed" });
    }
  }

  async heartbeat(req: Request, res: Response) {
    // Headless cafe senders hold no JWT. When a shared secret is configured,
    // require it. Without one: non-production keeps the historical
    // timestamp-only fail-open (logged once); production fails closed.
    if (env.syncSharedSecret) {
      const provided = req.headers["x-sync-secret"];
      if (provided !== env.syncSharedSecret) {
        logBlockedAttempt("heartbeat-unauthed", req.ip ?? null, "invalid_sync_secret");
        return res.status(401).json({ success: false, error: "Invalid sync secret." });
      }
    } else if (env.nodeEnv === "production") {
      if (!warnedUnconfiguredHeartbeat) {
        warnedUnconfiguredHeartbeat = true;
        logBlockedAttempt(
          "heartbeat-unauthed",
          req.ip ?? null,
          "SYNC_SHARED_SECRET unset (production reject)",
        );
        console.warn(
          "[sync] SYNC_SHARED_SECRET unset in production — /api/sync/heartbeat is disabled (503).",
        );
      }
      return res
        .status(503)
        .json({ success: false, message: "Sync not configured", error: "Sync not configured" });
    } else if (!warnedInsecureHeartbeat) {
      warnedInsecureHeartbeat = true;
      logBlockedAttempt(
        "heartbeat-unauthed",
        req.ip ?? null,
        "SYNC_SHARED_SECRET unset (non-prod fail-open)",
      );
      console.warn("[sync] SYNC_SHARED_SECRET unset — /api/sync/heartbeat accepts unauthenticated pings (timestamp-only).");
    }
    try {
      await cafeAvailabilityService.recordHeartbeat();
      return res.json({ success: true });
    } catch (err) {
      console.error("Heartbeat Error:", err);
      return res.status(500).json({ success: false, error: "Heartbeat failed" });
    }
  }

  /**
   * Manual Online → Local menu pull (preview by default). Staff roles only.
   * Body `{ dryRun: true }` (or env SYNC_MENU_DRY_RUN=true) returns the full
   * change preview with ZERO writes. Live mode writes a JSON backup first
   * and aborts if the backup fails.
   */
  async menuPull(req: Request, res: Response) {
    try {
      const dryRun = (req.body as any)?.dryRun === true;
      const plan = await menuPullService.pull({ dryRun });
      return res.json({ success: true, pull: plan });
    } catch (err) {
      console.error("Menu Pull Error:", err);
      return res.status(500).json({ success: false, error: "Menu pull failed" });
    }
  }
}

export const syncController = new SyncController();
