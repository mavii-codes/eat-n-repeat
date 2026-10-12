import crypto from "crypto";
import { hash } from "@/lib/bcrypt";
import { sendEmailVerificationCode } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import {
  assertResendCooldownOk,
  codeExpiryDate,
  generateVerificationCode,
} from "./verification-code";

export class ResendVerificationService {
  async execute(email: string) {
    const lowerEmail = email.toLowerCase();
    let customer = await customerAuthRepository.findCustomerByEmailWithIdStatus(lowerEmail);
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomersWithIdStatusEmail();
      const found = all.find((c) => c.email.toLowerCase() === lowerEmail);
      if (found) customer = { id: found.id, status: found.status } as any;
    }

    if (customer && customer.status === "pending_verification") {
      const latest = await customerAuthRepository.findLatestEmailVerificationTokenByCustomerId(
        customer.id,
      );
      assertResendCooldownOk(latest?.createdAt);

      await customerAuthRepository.deleteEmailVerificationTokensByCustomerId(customer.id);

      const code = generateVerificationCode();
      const tokenHash = await hash(code, 10);
      const tokenId = `ev-${crypto.randomUUID()}`;

      await customerAuthRepository.createEmailVerificationToken({
        id: tokenId,
        customerId: customer.id,
        tokenHash,
        expiresAt: codeExpiryDate(),
      });

      try {
        await sendEmailVerificationCode(email, code);
      } catch (error: any) {
        if (error?.message === "Email sending failed" || error?.message === "Missing SMTP configuration") {
          const err: any = new Error("Failed to send verification email. Please contact support or try again later.");
          err.statusCode = 500;
          throw err;
        }
        throw error;
      }
    }
  }
}

export const resendVerificationService = new ResendVerificationService();
