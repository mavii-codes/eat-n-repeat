import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { addonsController } from "@/controllers/addons.controller";

const router = Router();

router.get("/", (req, res) => addonsController.getAddons(req, res));
router.post("/", requireAuth, (req, res) => addonsController.createAddon(req, res));
router.put("/:id", requireAuth, (req, res) => addonsController.updateAddon(req, res));
router.delete("/:id", requireAuth, (req, res) => addonsController.deleteAddon(req, res));

export default router;
