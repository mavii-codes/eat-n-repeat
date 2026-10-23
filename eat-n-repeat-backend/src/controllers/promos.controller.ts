import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as promosService from "@/services/promos/promos.service";
import { promoValidateSchema } from "@/schema/promos/promos.schema";

/**
 * POST /api/promos/validate — preview-only endpoint for the cart and POS
 * panel. Guests allowed (optionalAuth); identity only matters for
 * LOGGED_IN/once-per-customer rules. The discount here is a preview: the
 * authoritative apply happens inside checkout with the server-computed
 * subtotal. The client never sends a discount or total.
 */
export class PromosController {
  async validate(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = promoValidateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.json({ ok: false, message: promosService.PROMO_MESSAGES.INVALID });
      }

      // Identity: customer tokens carry the customers.id; staff/guests are
      // anonymous for promo purposes (walk-ins at the counter).
      const auth = req.auth;
      const customer = auth?.kind === "customer" && auth.userId ? { id: auth.userId } : null;
      const channel = parsed.data.channel;
      const subtotal = parsed.data.subtotal;

      const result = await promosService.evaluatePromo({
        codeRaw: parsed.data.code,
        subtotal,
        channel,
        customer,
      });

      if (!result.ok) {
        return res.json({ ok: false, message: result.message });
      }

      return res.json({
        ok: true,
        code: result.promo.code,
        type: result.promo.type,
        discount: result.discount.toFixed(2),
      });
    } catch (error: any) {
      console.error("Error validating promo:", error);
      return res.json({ ok: false, message: promosService.PROMO_MESSAGES.INVALID });
    }
  }
}

export const promosController = new PromosController();
