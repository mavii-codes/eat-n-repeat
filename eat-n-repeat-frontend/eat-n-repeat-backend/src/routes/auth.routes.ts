import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { authController } from "@/controllers/auth.controller";

const router = Router();

router.post("/login", (req, res) => authController.login(req, res));
router.get("/me", requireAuth, (req, res) => authController.getMe(req, res));

export default router;
