import type { Request, Response } from "express";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeEmailSchema,
  resendVerificationSchema,
  verifyEmailCodeSchema,
  verifyResetCodeSchema,
} from "@/schema/customer-auth/customer-auth.schema";
import * as customerAuthService from "@/services/customer-auth";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import { verifyTurnstile } from "@/middleware/security/turnstile";

const SIGNUP_GENERIC_ERROR =
  "Sign-up failed. Please check your details and try again.";
const MIN_SUBMIT_MS = 3000;

/** ISO string or epoch milliseconds -> epoch ms, or null when unparseable. */
function parseStartedAt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export class CustomerAuthController {
  async register(req: Request, res: Response) {
    const ip = req.ip ?? null;
    try {
      const body = req.body ?? {};

      // Honeypot: hidden "company" field is empty for humans.
      const honeypot = body.company;
      if (
        honeypot !== undefined &&
        honeypot !== null &&
        String(honeypot).trim() !== ""
      ) {
        logBlockedAttempt("honeypot", ip, "non-empty honeypot");
        return res.status(400).json({ message: SIGNUP_GENERIC_ERROR });
      }

      // Minimum submit time: bots post instantly after loading the form.
      const rawStartedAt = body.startedAt;
      if (rawStartedAt === undefined || rawStartedAt === null || rawStartedAt === "") {
        logBlockedAttempt("min-submit", ip, "startedAt missing");
        return res.status(400).json({ message: SIGNUP_GENERIC_ERROR });
      }
      const startedAtMs = parseStartedAt(rawStartedAt);
      if (startedAtMs === null) {
        logBlockedAttempt("min-submit", ip, "startedAt invalid");
        return res.status(400).json({ message: SIGNUP_GENERIC_ERROR });
      }
      if (Date.now() - startedAtMs < MIN_SUBMIT_MS) {
        logBlockedAttempt("min-submit", ip, "submitted too quickly");
        return res.status(400).json({ message: SIGNUP_GENERIC_ERROR });
      }

      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }

      const captcha = await verifyTurnstile(parsed.data.cfTurnstileToken, ip);
      if (!captcha.ok) {
        logBlockedAttempt("captcha", ip, captcha.message);
        return res.status(captcha.status).json({ message: captcha.message });
      }

      await customerAuthService.register(parsed.data, ip);
      return res.status(201).json({ message: "Account created successfully. Please verify your email." });
    } catch (error: any) {
      console.error("Register Error:", error);
      if (error.statusCode === 409) {
        return res.status(409).json({ message: error.message });
      }
      if (error.message === "Account created, but we failed to send the verification email. Please try logging in to resend." || error.message === "Email sending failed" || error.message === "Missing SMTP configuration") {
        return res.status(500).json({ message: "Account created, but we failed to send the verification email. Please try logging in to resend." });
      }
      const status = error.statusCode ?? 500;
      if (status === 500 && !error.statusCode) {
        return res.status(500).json({ message: "Internal server error." });
      }
      return res.status(status).json({ message: error.message ?? "Internal server error." });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Valid email and password are required." });
      }

      const ip = req.ip || "unknown";
      const result = await customerAuthService.login(parsed.data, ip);
      return res.json(result);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Valid email is required." });
      }

      await customerAuthService.forgotPassword(parsed.data.email);
      // Generic for existent and non-existent emails alike (anti-enumeration).
      return res.json({ message: "If an account exists for this email, a verification code has been sent." });
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (error.message === "Email sending failed" || error.message === "Missing SMTP configuration" || error.message === "Failed to send password reset email. Please contact support or try again later.") {
        return res.status(500).json({ message: "Failed to send password reset email. Please contact support or try again later." });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }

      await customerAuthService.resetPassword({
        token: parsed.data.token,
        resetToken: parsed.data.resetToken,
        password: parsed.data.password,
      });
      return res.json({ message: "Password has been successfully reset." });
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Invalid or missing token." });

      await customerAuthService.verifyEmail(token);
      return res.json({ message: "Email successfully verified!" });
    } catch (error: any) {
      console.error("Verify Email Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async verifyEmailCode(req: Request, res: Response) {
    try {
      const parsed = verifyEmailCodeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

      await customerAuthService.verifyEmailCode(parsed.data.email, parsed.data.code);
      return res.json({ message: "Email successfully verified!" });
    } catch (error: any) {
      console.error("Verify Email Code Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async verifyResetCode(req: Request, res: Response) {
    try {
      const parsed = verifyResetCodeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

      const result = await customerAuthService.verifyResetCode(parsed.data.email, parsed.data.code);
      return res.json({ message: "Code verified.", resetToken: result.resetToken });
    } catch (error: any) {
      console.error("Verify Reset Code Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const parsed = resendVerificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Valid email is required." });

      await customerAuthService.resendVerification(parsed.data.email);
      return res.json({ message: "If an unverified account exists, a new code has been sent." });
    } catch (error: any) {
      console.error("Resend Verification Error:", error);
      if (error.message === "Email sending failed" || error.message === "Missing SMTP configuration" || error.message === "Failed to send verification email. Please contact support or try again later.") {
        return res.status(500).json({ message: "Failed to send verification email. Please contact support or try again later." });
      }
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async changeEmail(req: Request, res: Response) {
    try {
      const parsed = changeEmailSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

      await customerAuthService.changeEmail(parsed.data);
      return res.json({ message: "Email address updated and a new verification code sent." });
    } catch (error: any) {
      console.error("Change Email Error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (error.message === "Email sending failed" || error.message === "Missing SMTP configuration" || error.message === "Email updated, but we failed to send the verification email. Please try logging in to resend.") {
        return res.status(500).json({ message: "Email updated, but we failed to send the verification email. Please try logging in to resend." });
      }
      return res.status(500).json({ message: "Internal server error." });
    }
  }
}

export const customerAuthController = new CustomerAuthController();
