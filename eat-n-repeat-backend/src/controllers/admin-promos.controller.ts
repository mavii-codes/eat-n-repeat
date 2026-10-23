import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import {
  AdminPromoError,
  createPromo,
  deletePromo,
  listPromos,
  listPromoRedemptions,
  pausePromo,
  activatePromo,
  updatePromo,
} from "@/services/promos/admin-promos.service";
import { promoCreateSchema, promoUpdateSchema } from "@/schema/promos/promos.schema";

/**
 * Admin-only promo management controller (mounted at /api/admin/promos).
 * requireRole("admin") on the router gives customers and staff the 403
 * before any of these run. 409-class responses keep the service message
 * verbatim — the admin UI surfaces it word for word.
 */
export class AdminPromosController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const { rows, total } = await listPromos({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      return res.json({ rows, total });
    } catch (error: any) {
      return this.fail(res, error, "Failed to load promo codes");
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = promoCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? "Invalid promo details." });
      }
      const promo = await createPromo(parsed.data, req.auth?.userId ?? "");
      return res.json({ message: "Promo code created.", promo });
    } catch (error: any) {
      return this.fail(res, error, "Failed to create promo");
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = promoUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? "Invalid promo details." });
      }
      const promo = await updatePromo(req.params.id as string, parsed.data, req.auth?.userId ?? "");
      return res.json({ message: "Promo code updated.", promo });
    } catch (error: any) {
      return this.fail(res, error, "Failed to update promo");
    }
  }

  async pause(req: AuthenticatedRequest, res: Response) {
    try {
      const promo = await pausePromo(req.params.id as string, req.auth?.userId ?? "");
      return res.json({ message: "Promo code paused.", promo });
    } catch (error: any) {
      return this.fail(res, error, "Failed to pause promo");
    }
  }

  async activate(req: AuthenticatedRequest, res: Response) {
    try {
      const promo = await activatePromo(req.params.id as string, req.auth?.userId ?? "");
      return res.json({ message: "Promo code activated.", promo });
    } catch (error: any) {
      return this.fail(res, error, "Failed to activate promo");
    }
  }

  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await deletePromo(req.params.id as string, req.auth?.userId ?? "");
      return res.json({ message: "Promo code deleted.", ...result });
    } catch (error: any) {
      return this.fail(res, error, "Failed to delete promo");
    }
  }

  async redemptions(req: AuthenticatedRequest, res: Response) {
    try {
      const { rows, total, code } = await listPromoRedemptions(req.params.id as string, {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
      });
      return res.json({ rows, total, code });
    } catch (error: any) {
      return this.fail(res, error, "Failed to load promo usage");
    }
  }

  private fail(res: Response, error: any, fallback: string) {
    if (error instanceof AdminPromoError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("[admin-promos]", error);
    return res.status(500).json({ message: fallback });
  }
}

export const adminPromosController = new AdminPromosController();
