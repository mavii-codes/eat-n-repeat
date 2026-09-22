import crypto from "crypto";
import { hash } from "@/lib/bcrypt";
import { sendResetEmail } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

export class ForgotPasswordService {
  async execute(email: string) {
    const lowerEmail = email.toLowerCase();
    let customer = await customerAuthRepository.findCustomerByEmailWithIdStatusEmail(lowerEmail);
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomersWithIdStatusEmail();
      customer = all.find((c) => c.email.toLowerCase() === lowerEmail) ?? null;
    }

    if (!customer) {
      // Deliberately silent: prevents account-enumeration via response differences.
      return;
    }

    if (customer.status !== "active") {
      // Deliberately silent for the same reason; the generic controller
      // message covers all non-sendable cases.
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const tokenId = `rt-${crypto.randomUUID()}`;

    await customerAuthRepository.createPasswordResetToken({
      id: tokenId,
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    try {
      await sendResetEmail(email, resetToken);
    } catch (error: any) {
      if (error?.message === "Email sending failed" || error?.message === "Missing SMTP configuration") {
        const err: any = new Error("Failed to send password reset email. Please contact support or try again later.");
        err.statusCode = 500;
        throw err;
      }
      throw error;
    }
  }
}

export const forgotPasswordService = new ForgotPasswordService();
