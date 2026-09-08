import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { deliveryController } from "@/controllers/delivery.controller";

const router = Router();
router.use(requireAuth);

router.get("/orders", (req, res) => deliveryController.getOrders(req, res));
router.post("/orders", (req, res) => deliveryController.createOrder(req, res));
router.patch("/orders/:id/status", (req, res) => deliveryController.updateStatus(req, res));
router.patch("/orders/:id/person", (req, res) => deliveryController.updatePerson(req, res));
router.patch("/orders/:id/reassign", (req, res) => deliveryController.reassign(req, res));
router.patch("/orders/:id/cancel", (req, res) => deliveryController.cancel(req, res));

export default router;
