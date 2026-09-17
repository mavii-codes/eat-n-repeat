import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as customerSettingsService from "@/services/customer-settings";

export class CustomerSettingsController {
  async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      const customer = await customerSettingsService.getCustomerSettings(customerId);

      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      let preferences: any = (customer as any).notificationPreferences;
      if (!preferences) {
        preferences = {
          order_status: true,
          promotions: true,
          new_menu: true,
          announcements: true,
        };
      } else if (typeof preferences === "string") {
        try {
          preferences = JSON.parse(preferences);
        } catch {}
      }

      res.json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        avatar_url: customer.avatarUrl,
        notification_preferences: preferences,
        created_at: customer.createdAt,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    const { name, phone, avatar_url, notification_preferences } = req.body;
    const customerId = req.auth!.userId;

    try {
      await customerSettingsService.updateCustomerSettings(customerId, {
        name,
        phone,
        avatarUrl: avatar_url,
        notificationPreferences: notification_preferences ?? null,
      });

      res.json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    const { currentPassword, newPassword } = req.body;
    const customerId = req.auth!.userId;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      res.status(400).json({ error: "Invalid password data provided" });
      return;
    }

    try {
      const result = await customerSettingsService.changePassword(customerId, currentPassword, newPassword);

      if (result.error === "not_found") {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      if (result.error === "incorrect_password") {
        res.status(401).json({ error: "Incorrect current password" });
        return;
      }

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      await customerSettingsService.deleteAccount(customerId);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const customerSettingsController = new CustomerSettingsController();
