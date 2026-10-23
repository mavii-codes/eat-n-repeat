import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { createRateLimiter } from "@/middleware/security/rate-limiter";
import { syncController } from "@/controllers/sync.controller";

const router = Router();

// Per-IP cap on offline-queue drains (replay work is expensive and
// customer tokens are allowed). Rate limits are logged by the limiter.
const offlineSyncLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  logType: "sync-offline",
});

// GET /status stays public (read-only availability info polled by LAN
// clients and the server-side chat route).
router.get("/status", (req, res) => syncController.getStatus(req, res));
// Offline queue drain accepts any authenticated JWT (staff token or the
// customer's own backend token); the handler is idempotent and keyed by
// client-generated IDs. Customer tokens are scoped to offline_orders only.
router.post("/offline", offlineSyncLimiter, requireAuth, (req, res) =>
  syncController.offline(req, res),
);
// Bulk push + heartbeat can inject/alter server state: staff roles only.
// (Heartbeat senders without a JWT must set SYNC_SHARED_SECRET, see controller.)
router.post("/push", requireRole(...STAFF_ROLES), (req, res) => syncController.push(req, res));
router.post("/heartbeat", (req, res) => syncController.heartbeat(req, res));
// Manual Online → Local menu pull (preview by default; staff roles only).
// Writes go to THIS database only — there is no Local → Online path.
router.post("/menu/pull", requireRole(...STAFF_ROLES), (req, res) => syncController.menuPull(req, res));

export const syncRouter = router;
export default router;
