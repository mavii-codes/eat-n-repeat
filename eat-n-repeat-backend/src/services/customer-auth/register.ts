import crypto from "crypto";
import { hash } from "@/lib/bcrypt";
import { sendVerificationEmail } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

export class RegisterService {
  async execute(data: { name: string; email: string; phone?: string; password: string }) {
    const { name, email, phone, password } = data;

    // Check duplicate (case-insensitive)
    const existing = await customerAuthRepository.findCustomerByEmail(email.toLowerCase());
    if (existing) {
      const err: any = new Error("An account with this email already exists.");
      err.statusCode = 409;
      throw err;
    }
    // Extra JS-level check for existing emails with different casing (in case DB collation is case-sensitive)
    const allCustomers = await customerAuthRepository.findAllCustomerEmails();
    if (allCustomers.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
      const err: any = new Error("An account with this email already exists.");
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await hash(password, 12);
    const id = `cust-${crypto.randomUUID()}`;

    await customerAuthRepository.createCustomer({
      id,
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      passwordHash,
      status: "pending_verification",
    });

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hash(verifyToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenId = `ev-${crypto.randomUUID()}`;

    await customerAuthRepository.createEmailVerificationToken({
      id: tokenId,
      customerId: id,
      tokenHash,
      expiresAt,
    });

    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (error: any) {
      if (error?.message === "Email sending failed" || error?.message === "Missing SMTP configuration") {
        const err: any = new Error("Account created, but we failed to send the verification email. Please try logging in to resend.");
        err.statusCode = 500;
        throw err;
      }
      throw error;
    }
  }
}

export const registerService = new RegisterService();
