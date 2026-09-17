import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerSettingsController } from "@/controllers/customer-settings.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerSettingsController.getSettings(req, res));
router.put("/", requireAuth, (req, res) => customerSettingsController.updateSettings(req, res));
router.put("/password", requireAuth, (req, res) => customerSettingsController.changePassword(req, res));
router.delete("/account", requireAuth, (req, res) => customerSettingsController.deleteAccount(req, res));

export default router;
