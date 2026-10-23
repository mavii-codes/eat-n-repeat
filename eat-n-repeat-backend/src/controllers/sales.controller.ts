import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { salesFiguresQuerySchema } from "@/schema/sales/figures.schema";
import { salesFiguresService } from "@/services/sales";

export class SalesController {
  async figures(req: AuthenticatedRequest, res: Response) {
    if (!req.auth?.userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }

    const parsed = salesFiguresQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const figures = await salesFiguresService.execute();
      return res.json({ success: true, ...figures });
    } catch (error) {
      console.error("Error loading sales figures:", error);
      return res
        .status(500)
        .json({ success: false, message: "Server error" });
    }
  }
}

export const salesController = new SalesController();
