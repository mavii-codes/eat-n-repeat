import type { Request, Response } from "express";
import * as service from "@/services/sync";

export class SyncController {
  async getStatus(_req: Request, res: Response) {
    const result = await service.getSyncStatus();
    return res.json(result);
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
}

export const syncController = new SyncController();
