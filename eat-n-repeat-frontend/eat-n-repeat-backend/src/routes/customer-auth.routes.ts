import { Router } from "express";
import { customerAuthController } from "@/controllers/customer-auth.controller";

const router = Router();

router.post("/register", (req, res) => customerAuthController.register(req, res));
router.post("/login", (req, res) => customerAuthController.login(req, res));
router.post("/forgot-password", (req, res) => customerAuthController.forgotPassword(req, res));
router.post("/reset-password", (req, res) => customerAuthController.resetPassword(req, res));
router.get("/verify-email", (req, res) => customerAuthController.verifyEmail(req, res));
router.post("/resend-verification", (req, res) => customerAuthController.resendVerification(req, res));
router.post("/change-email", (req, res) => customerAuthController.changeEmail(req, res));

export default router;
