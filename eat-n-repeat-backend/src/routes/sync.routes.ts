import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { syncController } from "@/controllers/sync.controller";

const router = Router();

// GET /status stays public (read-only availability info polled by LAN
// clients and the server-side chat route).
router.get("/status", (req, res) => syncController.getStatus(req, res));
// Offline queue drain accepts any authenticated JWT (staff token or the
// customer's own backend token); the handler is idempotent and keyed by
// client-generated IDs. Anonymous callers are rejected.
router.post("/offline", requireAuth, (req, res) => syncController.offline(req, res));
// Bulk push + heartbeat can inject/alter server state: staff roles only.
// (Heartbeat senders without a JWT must set SYNC_SHARED_SECRET, see controller.)
router.post("/push", requireRole(...STAFF_ROLES), (req, res) => syncController.push(req, res));
router.post("/heartbeat", (req, res) => syncController.heartbeat(req, res));

export const syncRouter = router;
export default router;
