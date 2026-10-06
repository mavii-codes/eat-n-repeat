import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerOrdersController } from "@/controllers/customer-orders.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerOrdersController.getCustomerOrders(req, res));

// Customer self-cancellation (pending orders only; ownership enforced in
// the service lookup). Separate from the staff PATCH status endpoint,
// which requires a staff role and must never serve customers.
router.post("/:id/cancel", requireAuth, (req, res) => customerOrdersController.cancelOrder(req, res));

export default router;
