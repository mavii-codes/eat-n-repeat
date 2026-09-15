import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { cafeAvailabilityModeSchema } from "@/schema/cafe-availability/cafe-availability.schema";
import { cafeAvailabilityService } from "@/services/cafe-availability";
import { prisma } from "@/lib/prisma";

export class AdminCafeAvailabilityController {
  async setMode(req: AuthenticatedRequest, res: Response) {
    try {
      // Admin role check — follows existing pattern (see cash/addons services)
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required." });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user || user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Admin access required." });
      }

      const parsed = cafeAvailabilityModeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid mode. Must be AUTO, FORCE_AVAILABLE, or FORCE_UNAVAILABLE.",
        });
      }

      await cafeAvailabilityService.setOverride(parsed.data.mode);

      return res.json({ success: true, mode: parsed.data.mode });
    } catch (error) {
      console.error("Error setting cafe availability:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const adminCafeAvailabilityController = new AdminCafeAvailabilityController();
