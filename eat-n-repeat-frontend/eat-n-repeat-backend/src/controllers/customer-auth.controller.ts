import type { Request, Response } from "express";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeEmailSchema,
  resendVerificationSchema,
} from "@/schema/customer-auth/customer-auth.schema";
import * as customerAuthService from "@/services/customer-auth";

export class CustomerAuthController {
  async register(req: Request, res: Response) {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }

      await customerAuthService.register(parsed.data);
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
      return res.json({ message: "A reset link has been sent to your email." });
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

      await customerAuthService.resetPassword(parsed.data.token, parsed.data.password);
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

  async resendVerification(req: Request, res: Response) {
    try {
      const parsed = resendVerificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Valid email is required." });

      await customerAuthService.resendVerification(parsed.data.email);
      return res.json({ message: "If an unverified account exists, a new link has been sent." });
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
      return res.json({ message: "Email address updated and a new verification link sent." });
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
