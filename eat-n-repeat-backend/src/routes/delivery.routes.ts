import { Router } from "express";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { deliveryController } from "@/controllers/delivery.controller";

const router = Router();

// Delivery dispatch is a staff-only console. There are no customer consumers
// of /delivery/* (customer order history lives under /customer-orders).
router.use(requireRole(...STAFF_ROLES));

router.get("/orders", (req, res) => deliveryController.getOrders(req, res));
router.post("/orders", (req, res) => deliveryController.createOrder(req, res));
router.patch("/orders/:id/status", (req, res) => deliveryController.updateStatus(req, res));
router.patch("/orders/:id/person", (req, res) => deliveryController.updatePerson(req, res));
router.patch("/orders/:id/reassign", (req, res) => deliveryController.reassign(req, res));
router.patch("/orders/:id/cancel", (req, res) => deliveryController.cancel(req, res));

export default router;
