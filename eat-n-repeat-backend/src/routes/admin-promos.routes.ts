import { Router } from "express";
import { requireRole } from "@/middleware/requireRole.middleware";
import { adminPromosController } from "@/controllers/admin-promos.controller";

const router = Router();

// Strictly admin: staff, head_staff and customer JWTs get 403 via requireRole.
// Static paths before parameterized ones.
router.get("/", requireRole("admin"), (req, res) => adminPromosController.list(req, res));
router.post("/", requireRole("admin"), (req, res) => adminPromosController.create(req, res));

router.get("/:id/redemptions", requireRole("admin"), (req, res) =>
  adminPromosController.redemptions(req, res),
);
router.patch("/:id", requireRole("admin"), (req, res) => adminPromosController.update(req, res));
router.post("/:id/pause", requireRole("admin"), (req, res) => adminPromosController.pause(req, res));
router.post("/:id/activate", requireRole("admin"), (req, res) => adminPromosController.activate(req, res));
router.post("/:id/delete", requireRole("admin"), (req, res) => adminPromosController.remove(req, res));

export default router;
