import { Router } from "express";
import { env } from "@/config/env";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { createRateLimiter } from "@/middleware/security/rate-limiter";
import { eventsController } from "@/controllers/events.controller";

const router = Router();

// Payment stream: staff-only (payload is scrubbed in lib/sse). Per-IP limit
// also caps connection churn and reconnect loops before the JWT/DB lookup.
const paymentStreamLimiter = createRateLimiter({
  windowMs: 60_000,
  max: env.reviewStreamRatePerMin,
  logType: "sse-stream",
});

router.get(
  "/stream",
  paymentStreamLimiter,
  requireRole(...STAFF_ROLES),
  (req, res) => eventsController.stream(req, res),
);
router.get("/admin/stream", requireAuth, requireRole("admin"), (req, res) =>
  eventsController.adminStreamHandler(req, res),
);
router.get("/order-chat/:orderId/stream", requireAuth, (req, res) => eventsController.streamOrderChat(req, res));
// Public read-only review channel (global REVIEW_* events, public payload
// only). No auth on purpose: guests receive the same public rating data.
// Rate-limited per IP to stop stream floods.
const reviewStreamLimiter = createRateLimiter({
  windowMs: 60_000,
  max: env.reviewStreamRatePerMin,
  logType: "sse-stream",
});

router.get(
  "/reviews/stream",
  reviewStreamLimiter,
  (req, res) => eventsController.streamReviewEvents(req, res),
);

export default router;
