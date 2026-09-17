import { Router } from "express";
import { staffNotificationsController } from "@/controllers/staff-notifications.controller";

const router = Router();

router.get("/", (req, res) => staffNotificationsController.getNotifications(req, res));
router.post("/:id/read", (req, res) => staffNotificationsController.markAsRead(req, res));
router.post("/read-all", (req, res) => staffNotificationsController.markAllAsRead(req, res));

export default router;
