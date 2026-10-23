import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/requireRole.middleware";
import { salesController } from "@/controllers/sales.controller";

const router = Router();

router.use(requireAuth);

// Admin-only dashboard figures (single source of truth for revenue).
router.get("/figures", requireRole("admin"), (req, res) =>
  salesController.figures(req, res),
);

export default router;
