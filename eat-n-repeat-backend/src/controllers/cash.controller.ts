import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { startShiftSchema, endShiftSchema, addFloatSchema } from "@/schema/cash/cash.schema";
import * as service from "@/services/cash";

export class CashController {
  async getCurrentShift(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const shift = await service.getCurrentShift(userId);
      res.json({ success: true, shift: shift ?? null });
    } catch (error) {
      console.error("Error fetching current shift:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async startShift(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const parsed = startShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid starting float" });
      }

      const { startingFloat } = parsed.data;

      try {
        const shift = await service.startShift(userId, startingFloat);
        res.json({ success: true, shift });
      } catch (err: any) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error starting shift:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async endShift(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const parsed = endShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid actual cash amount" });
      }

      const { shiftId, actualCash } = parsed.data;

      try {
        const shift = await service.endShift(userId, shiftId, actualCash);
        res.json({ success: true, shift });
      } catch (err: any) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error ending shift:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async getAllShifts(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const isAdmin = await service.isAdminUser(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Admin access required" });
      }

      const shifts = await service.getAllShifts();
      res.json({ success: true, shifts });
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async getShiftDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const isAdmin = await service.isAdminUser(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Admin access required" });
      }

      const id = req.params.id as string;
      try {
        const { shift, transactions } = await service.getShiftDetails(id);
        res.json({ success: true, shift, transactions });
      } catch (err: any) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error fetching shift details:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async addFloat(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

      const isAdmin = await service.isAdminUser(userId);
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Admin access required" });
      }

      const parsed = addFloatSchema.safeParse(req.body);
      if (!parsed.success) {
        const err = parsed.error.issues[0];
        // Map validation errors to legacy messages
        if (err.path.includes("amount")) {
          return res.status(400).json({ success: false, message: "Invalid amount" });
        }
        if (err.path.includes("reason")) {
          return res.status(400).json({ success: false, message: "Reason is required" });
        }
        return res.status(400).json({ success: false, message: "Invalid request" });
      }

      const { amount, reason } = parsed.data;
      const id = req.params.id as string;

      try {
        await service.addFloat(id, amount, reason, userId);
        res.json({ success: true });
      } catch (err: any) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error adding float:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const cashController = new CashController();
