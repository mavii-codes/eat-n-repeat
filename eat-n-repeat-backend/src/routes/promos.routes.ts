import { Router } from "express";
import { env } from "@/config/env";
import { optionalAuth } from "@/middleware/auth.middleware";
import { promosController } from "@/controllers/promos.controller";
import { createRateLimiter } from "@/middleware/security/rate-limiter";

const router = Router();

// ── Promo validate abuse limits ──
// Two fixed windows per attempt, thresholds from env (defaults 10 / 15 min):
// per-account+IP keyed via optionalAuth's resolved principal, and a plain
// per-IP window so rotating accounts can't share the same pipe.
const promoValidateDynamic = {
  windowMs: env.rateLimits.promoWindowMinutes * 60_000,
  max: env.rateLimits.promoValidateAttempts,
  message: "Too many promo attempts. Please wait a few minutes and try again.",
  logType: "promo-validate" as const,
};
const promoValidateAccountLimiter = createRateLimiter({
  ...promoValidateDynamic,
  keyFn: (req) => String((req as any).auth?.userId ?? "anon"),
});
const promoValidateIpLimiter = createRateLimiter({ ...promoValidateDynamic });

// Cart and POS preview. optionalAuth first so the account key resolves.
router.post(
  "/validate",
  optionalAuth,
  promoValidateAccountLimiter,
  promoValidateIpLimiter,
  (req, res) => promosController.validate(req, res),
);

export default router;
