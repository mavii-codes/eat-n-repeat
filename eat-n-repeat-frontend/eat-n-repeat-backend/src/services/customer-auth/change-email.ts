import crypto from "crypto";
import { hash, compare } from "@/lib/bcrypt";
import { sendVerificationEmail } from "@/lib/email";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

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

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hash(verifyToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenId = `ev-${crypto.randomUUID()}`;

    await customerAuthRepository.createEmailVerificationToken({
      id: tokenId,
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    try {
      await sendVerificationEmail(newEmail, verifyToken);
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
