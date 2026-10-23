import { Router } from "express";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { staffNotificationsController } from "@/controllers/staff-notifications.controller";

const router = Router();

// Staff notifications are staff/admin data; customer JWTs are rejected.
router.use(requireRole(...STAFF_ROLES));

router.get("/", (req, res) => staffNotificationsController.getNotifications(req, res));
router.post("/:id/read", (req, res) => staffNotificationsController.markAsRead(req, res));
router.post("/read-all", (req, res) => staffNotificationsController.markAllAsRead(req, res));

export default router;
