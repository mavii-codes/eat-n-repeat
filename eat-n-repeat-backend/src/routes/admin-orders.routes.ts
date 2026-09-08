import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { adminOrdersController } from "@/controllers/admin-orders.controller";

const router = Router();

router.get("/", (req, res) => adminOrdersController.getOrders(req, res));
router.patch("/:id/status", (req, res) => adminOrdersController.updateStatus(req, res));
router.patch("/:id/payment", requireAuth, (req, res) => adminOrdersController.markAsPaid(req, res));

export default router;
