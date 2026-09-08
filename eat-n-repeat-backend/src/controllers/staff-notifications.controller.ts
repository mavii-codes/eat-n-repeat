import type { Request, Response } from "express";
import * as service from "@/services/staff-notifications";

export class StaffNotificationsController {
  async getNotifications(_req: Request, res: Response) {
    try {
      const notifications = await service.getStaffNotifications();
      res.json({ success: true, notifications });
    } catch (error) {
      console.error("Error fetching staff notifications:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const notificationId = req.params.id as string;
      await service.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking staff notification as read:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async markAllAsRead(_req: Request, res: Response) {
    try {
      await service.markAllAsRead();
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all staff notifications as read:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const staffNotificationsController = new StaffNotificationsController();
