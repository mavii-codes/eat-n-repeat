import { Router } from "express";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { adminOrdersController } from "@/controllers/admin-orders.controller";

const router = Router();

// Order list, status changes, and payment confirmation all require a
// staff-role JWT. Customer and anonymous callers are rejected.
router.get("/", requireRole(...STAFF_ROLES), (req, res) => adminOrdersController.getOrders(req, res));
// Paginated history (completed/cancelled, newest-first). Static path declared
// before any parameterized routes so it is never captured as an :id.
router.get("/history", requireRole(...STAFF_ROLES), (req, res) => adminOrdersController.getHistory(req, res));
router.patch("/:id/status", requireRole(...STAFF_ROLES), (req, res) => adminOrdersController.updateStatus(req, res));
router.patch("/:id/payment", requireRole(...STAFF_ROLES), (req, res) => adminOrdersController.markAsPaid(req, res));

export default router;
