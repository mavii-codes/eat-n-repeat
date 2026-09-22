import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { staffNotificationsController } from "@/controllers/staff-notifications.controller";

const router = Router();

// Staff notifications require a valid JWT (any authenticated user).
router.get("/", requireAuth, (req, res) => staffNotificationsController.getNotifications(req, res));
router.post("/:id/read", requireAuth, (req, res) => staffNotificationsController.markAsRead(req, res));
router.post("/read-all", requireAuth, (req, res) => staffNotificationsController.markAllAsRead(req, res));

export default router;
