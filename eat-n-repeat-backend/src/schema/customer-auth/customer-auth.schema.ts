import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid email address."),
  // Optional client-supplied username; validated/locked in the register
  // service. Customers authenticate by email, so it is never persisted.
  username: z.string().trim().optional(),
  // No mobile number at sign-up (Phase 3): collected at first checkout and
  // then permanent. Any `phone` key in the body is ignored, never stored.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  // Bot-protection fields. Unknown keys are stripped by Zod's object parsing.
  company: z.string().optional(),
  startedAt: z.union([z.string(), z.number()]).optional(),
  cfTurnstileToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const sixDigitCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Please enter the 6-digit code.");

export const resetPasswordSchema = z
  .object({
    // Legacy emailed link token (kept working for links sent before codes).
    token: z.string().min(1).optional(),
    // Short-lived authorization from verify-reset-code (new code flow).
    resetToken: z.string().min(1).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  })
  .refine((v) => v.token || v.resetToken, {
    message: "A reset token is required.",
  });

export const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email(),
  code: sixDigitCode,
});

export const verifyResetCodeSchema = z.object({
  email: z.string().trim().email(),
  code: sixDigitCode,
});

export const changeEmailSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  newEmail: z.string().trim().email("Please provide a valid new email address."),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;
