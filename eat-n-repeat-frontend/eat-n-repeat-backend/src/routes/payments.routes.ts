import { Router } from "express";
import { requireAuth, optionalAuth } from "@/middleware/auth.middleware";
import { paymentsController } from "@/controllers/payments.controller";

const router = Router();

router.post("/checkout", optionalAuth, (req, res) => paymentsController.checkout(req, res));
router.get("/order/:orderId", (req, res) => paymentsController.getPayment(req, res));
router.post("/retry/:orderId", requireAuth, (req, res) => paymentsController.retry(req, res));

export default router;
