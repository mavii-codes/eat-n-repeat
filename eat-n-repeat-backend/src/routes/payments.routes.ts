import { Router } from "express";
import { env } from "@/config/env";
import { requireAuth, optionalAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { paymentsController } from "@/controllers/payments.controller";
import { createRateLimiter } from "@/middleware/security/rate-limiter";

const router = Router();

// Customer/guest checkout burst limit. Must run AFTER optionalAuth so a
// signed-in staff/admin walk-in POS sale can skip it entirely.
const checkoutHourlyLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: env.rateLimits.checkoutHourly,
  message: "Too many orders placed from this connection. Please try again later.",
  logType: "checkout-burst",
  skip: (req) => (req as any).auth?.kind === "user",
});

router.post("/checkout", optionalAuth, checkoutHourlyLimiter, (req, res) =>
  paymentsController.checkout(req, res),
);
// Payment details include the order snapshot (name, phone, address, items):
// staff-only. No customer/guest UI consumes this endpoint.
router.get("/order/:orderId", requireRole(...STAFF_ROLES), (req, res) =>
  paymentsController.getPayment(req, res),
);
// Any authenticated principal may retry, but customer tokens are restricted
// to their own orders in the controller.
router.post("/retry/:orderId", requireAuth, (req, res) => paymentsController.retry(req, res));

export default router;
