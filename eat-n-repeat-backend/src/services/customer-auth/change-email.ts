import crypto from "crypto";
import { hash, compare } from "@/lib/bcrypt";
import { sendEmailVerificationCode } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import {
  codeExpiryDate,
  generateVerificationCode,
} from "./verification-code";

export class ChangeEmailService {
  async execute(data: { email: string; password: string; newEmail: string }) {
    const { email, password, newEmail } = data;
    const lowerEmail = email.toLowerCase();
    const lowerNewEmail = newEmail.toLowerCase();

    let customer = await customerAuthRepository.findCustomerByEmail(lowerEmail);
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomers();
      customer = all.find((c) => c.email.toLowerCase() === lowerEmail) ?? null;
    }

    if (!customer || !(await compare(password, customer.passwordHash))) {
      const err: any = new Error("Invalid email or password.");
      err.statusCode = 401;
      throw err;
    }

    if (customer.status !== "pending_verification") {
      const err: any = new Error("Account is already verified or disabled.");
      err.statusCode = 400;
      throw err;
    }

    // Check if new email is taken
    const existingNew = await customerAuthRepository.findCustomerByEmail(lowerNewEmail);
    if (existingNew) {
      const err: any = new Error("The new email address is already in use.");
      err.statusCode = 409;
      throw err;
    }
    // Additional JS check for case-insensitive duplicate (covers collation differences)
    const allEmails = await customerAuthRepository.findAllCustomerEmails();
    if (allEmails.some((c) => c.email.toLowerCase() === lowerNewEmail)) {
      const err: any = new Error("The new email address is already in use.");
      err.statusCode = 409;
      throw err;
    }

    await customerAuthRepository.updateCustomerEmailById(customer.id, lowerNewEmail);

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
      await sendEmailVerificationCode(newEmail, code);
    } catch (error: any) {
      if (error?.message === "Email sending failed" || error?.message === "Missing SMTP configuration") {
        const err: any = new Error("Email updated, but we failed to send the verification email. Please try logging in to resend.");
        err.statusCode = 500;
        throw err;
      }
    }
  }
}

export const changeEmailService = new ChangeEmailService();
