import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { adminCafeAvailabilityController } from "@/controllers/admin-cafe-availability.controller";

const router = Router();

router.post("/", requireAuth, (req, res) =>
  adminCafeAvailabilityController.setMode(req, res)
);

export default router;
