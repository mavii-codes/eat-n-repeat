import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerOrdersController } from "@/controllers/customer-orders.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerOrdersController.getCustomerOrders(req, res));

export default router;
