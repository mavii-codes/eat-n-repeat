import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { cashController } from "@/controllers/cash.controller";

const router = Router();

router.get("/shift/current", requireAuth, (req, res) => cashController.getCurrentShift(req, res));
router.post("/shift/start", requireAuth, (req, res) => cashController.startShift(req, res));
router.post("/shift/end", requireAuth, (req, res) => cashController.endShift(req, res));
router.get("/shifts", requireAuth, (req, res) => cashController.getAllShifts(req, res));
router.get("/shifts/:id", requireAuth, (req, res) => cashController.getShiftDetails(req, res));
router.post("/shifts/:id/add-float", requireAuth, (req, res) => cashController.addFloat(req, res));

export default router;
