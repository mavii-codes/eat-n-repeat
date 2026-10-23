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
      const {
        offline_orders,
        offline_stock_transactions,
        offline_payments,
        offline_status_changes,
        offline_shifts,
      } = req.body;
      const auth = req.auth;
      const drainingUserId = auth?.userId ?? null;

      if (auth?.kind === "customer") {
        // Customer tokens exist for offline cart journaling only. Privileged
        // replay sections would let a customer token move money/stock or
        // close shifts, so they are dropped before the service is called.
        const body = req.body as Record<string, unknown>;
        const dropped = CUSTOMER_DROPPED_SECTIONS.filter((section) => {
          const value = body[section];
          return Array.isArray(value) && value.length > 0;
        });

        if (dropped.length > 0) {
          console.warn(
            `[SECURITY] offline sync scoped: customer token, sections dropped: ${dropped.join(", ")}`,
          );
          logBlockedAttempt(
            "sync-scope-drop",
            req.ip ?? null,
            "customer_token_privileged_sections",
            { userId: auth.userId, dropped },
          );
        }

        // Replay of a journal with paid=true mirrors a PAID cash payment
        // (offline-sync). Customer journals are unpaid carts — the paid flag
        // is POS-only semantics, so strip it to keep paid-sale mirroring
        // out of customer-token reach.
        let strippedPaid = 0;
        const CUSTOMER_JOURNAL_STATUSES = new Set(["pending", "awaiting_payment"]);
        const safeOrders = (Array.isArray(offline_orders) ? offline_orders : []).map(
          (o: unknown) => {
            if (!o || typeof o !== "object") return o;
            const row = o as Record<string, unknown>;
            const { paid, ...rest } = row;
            if (paid !== undefined && paid !== false) strippedPaid += 1;
            // Echo discipline: the drain writes order.status verbatim, and the
            // customer app only ever journals unpaid carts, so clamp anything
            // else to "pending" (real journals are unpaid carts).
            if (typeof rest.status === "string" && !CUSTOMER_JOURNAL_STATUSES.has(rest.status)) {
              strippedPaid += 0; // status clamp does not count as a paid strip
              console.warn(`[SECURITY] offline sync scoped: customer token, journal status clamped: ${rest.status}`);
              rest.status = "pending";
            }
            return rest;
          },
        );
        if (strippedPaid > 0) {
          console.warn(
            `[SECURITY] offline sync scoped: customer token, paid flag stripped from ${strippedPaid} journal(s)`,
          );
          logBlockedAttempt(
            "sync-paid-strip",
            req.ip ?? null,
            "customer_token_paid_flag",
            { userId: auth.userId, count: strippedPaid },
          );
        }

        await service.offlineSync({ offline_orders: safeOrders }, drainingUserId);
        return res.json({ success: true, message: "Offline Sync successful" });
      }

      await service.offlineSync(
        { offline_orders, offline_stock_transactions, offline_payments, offline_status_changes, offline_shifts },
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
