import { Router } from "express";
import { env } from "@/config/env";
import { customerAuthController } from "@/controllers/customer-auth.controller";
import { createRateLimiter } from "@/middleware/security/rate-limiter";

const router = Router();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SIGNUP_MESSAGE = "Too many sign-ups from this connection. Try again later.";
const RESET_MESSAGE = "Too many reset requests. Try again later.";

// Sign-up spam protection: two IP-scoped fixed windows before the handler.
const signupHourlyLimiter = createRateLimiter({
  windowMs: HOUR_MS,
  max: env.rateLimits.signupHourly,
  message: SIGNUP_MESSAGE,
  logType: "signup-burst",
});

const signupDailyLimiter = createRateLimiter({
  windowMs: DAY_MS,
  max: env.rateLimits.signupDaily,
  message: SIGNUP_MESSAGE,
  logType: "signup-day",
});

// Password-reset flood limits. Existing resend cooldowns / attempt caps in
// the services stay in place behind these.
const forgotPasswordLimiter = createRateLimiter({
  windowMs: HOUR_MS,
  max: env.rateLimits.forgotHourly,
  message: RESET_MESSAGE,
  logType: "reset-flood",
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: HOUR_MS,
  max: env.rateLimits.resetHourly,
  message: RESET_MESSAGE,
  logType: "reset-flood",
});

router.post(
  "/register",
  signupHourlyLimiter,
  signupDailyLimiter,
  (req, res) => customerAuthController.register(req, res),
);
router.post("/login", (req, res) => customerAuthController.login(req, res));
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  (req, res) => customerAuthController.forgotPassword(req, res),
);
router.post(
  "/reset-password",
  resetPasswordLimiter,
  (req, res) => customerAuthController.resetPassword(req, res),
);
router.post("/verify-reset-code", (req, res) => customerAuthController.verifyResetCode(req, res));
router.get("/verify-email", (req, res) => customerAuthController.verifyEmail(req, res));
router.post("/verify-email-code", (req, res) => customerAuthController.verifyEmailCode(req, res));
router.post("/resend-verification", (req, res) => customerAuthController.resendVerification(req, res));
router.post("/change-email", (req, res) => customerAuthController.changeEmail(req, res));

export default router;
