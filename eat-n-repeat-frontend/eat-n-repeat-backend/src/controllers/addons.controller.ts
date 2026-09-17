import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { addonSchema } from "@/schema/addons/addons.schema";
import { getAddonsService, isAdminUserService, createAddonService, updateAddonService, deleteAddonService } from "@/services/addons";

export class AddonsController {
  async getAddons(req: Request, res: Response) {
    try {
      const isAdmin = req.query.admin === "true";
      const addons = await getAddonsService.execute(isAdmin);
      res.json({ success: true, addons });
    } catch (error) {
      console.error("Error fetching addons:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async createAddon(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });

      const isAdmin = await isAdminUserService.execute(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const parsed = addonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid addon data" });
      }

      const addon = await createAddonService.execute(parsed.data);
      res.json({ success: true, addon });
    } catch (error) {
      console.error("Error creating addon:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async updateAddon(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });

      const isAdmin = await isAdminUserService.execute(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const parsed = addonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid addon data" });
      }

      const id = req.params.id as string;
      const addon = await updateAddonService.execute(id, parsed.data);
      res.json({ success: true, addon });
    } catch (error) {
      console.error("Error updating addon:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async deleteAddon(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });

      const isAdmin = await isAdminUserService.execute(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const id = req.params.id as string;
      await deleteAddonService.execute(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting addon:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const addonsController = new AddonsController();
