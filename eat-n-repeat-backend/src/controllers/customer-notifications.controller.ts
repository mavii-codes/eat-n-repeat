import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as service from "@/services/customer-notifications";

export class CustomerNotificationsController {
  async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      const rows = await service.getNotifications(customerId);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createNotification(req: AuthenticatedRequest, res: Response) {
    const { type, title, description } = req.body;
    const customerId = req.auth!.userId;
    try {
      const id = await service.createNotification(customerId, type, title, description);
      res.json({ success: true, id });
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      await service.markAsRead(customerId, req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      await service.markAllAsRead(customerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      await service.deleteNotification(customerId, req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async clearAll(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      await service.clearAll(customerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const customerNotificationsController = new CustomerNotificationsController();
