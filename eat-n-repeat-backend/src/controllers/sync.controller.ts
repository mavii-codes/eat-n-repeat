import type { Request, Response } from "express";
import { env } from "@/config/env";
import * as service from "@/services/sync";
import { menuPullService } from "@/services/menu-pull";
import { cafeAvailabilityService } from "@/services/cafe-availability";

let warnedInsecureHeartbeat = false;

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

  async offline(req: Request, res: Response) {
    try {
      const { offline_orders, offline_stock_transactions } = req.body;
      await service.offlineSync({ offline_orders, offline_stock_transactions });
      return res.json({ success: true, message: "Offline Sync successful" });
    } catch (err) {
      console.error("Offline Sync Error:", err);
      return res.status(500).json({ success: false, error: "Offline Sync failed" });
    }
  }

  async heartbeat(req: Request, res: Response) {    // Headless café senders hold no JWT. When a shared secret is configured,
    // require it; otherwise accept the timestamp-only write (documented).
    if (env.syncSharedSecret) {
      const provided = req.headers["x-sync-secret"];
      if (provided !== env.syncSharedSecret) {
        return res.status(401).json({ success: false, error: "Invalid sync secret." });
      }
    } else if (!warnedInsecureHeartbeat) {
      warnedInsecureHeartbeat = true;
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
