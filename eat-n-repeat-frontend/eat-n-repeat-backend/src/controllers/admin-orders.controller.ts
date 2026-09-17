import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { statusSchema } from "@/schema/admin-orders/admin-orders.schema";
import * as adminOrdersService from "@/services/admin-orders";

export class AdminOrdersController {
  async getOrders(_req: AuthenticatedRequest, res: Response) {
    try {
      const orders = await adminOrdersService.getAdminOrders();
      res.json({ success: true, orders });
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid status." });
      }
      const { status } = parsed.data;
      await adminOrdersService.updateAdminOrderStatus(req.params.id as string, status);
      res.json({ success: true, message: "Order status updated" });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
      if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
      console.error("Error updating order status:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async markAsPaid(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = (req as any).user?.id ?? (req as any).auth?.userId;
      const result = await adminOrdersService.markOrderAsPaid(req.params.id as string, req.body, userId);
      res.json({ success: true, message: "Order marked as paid", change: result.change });
    } catch (error: any) {
      if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
      if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
      if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
      console.error("Error marking order as paid:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const adminOrdersController = new AdminOrdersController();
