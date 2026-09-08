import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerNotificationsController } from "@/controllers/customer-notifications.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerNotificationsController.getNotifications(req, res));
router.post("/", requireAuth, (req, res) => customerNotificationsController.createNotification(req, res));
router.put("/read-all", requireAuth, (req, res) => customerNotificationsController.markAllAsRead(req, res));
router.put("/:id/read", requireAuth, (req, res) => customerNotificationsController.markAsRead(req, res));
router.delete("/clear-all", requireAuth, (req, res) => customerNotificationsController.clearAll(req, res));
router.delete("/:id", requireAuth, (req, res) => customerNotificationsController.deleteNotification(req, res));

export default router;
