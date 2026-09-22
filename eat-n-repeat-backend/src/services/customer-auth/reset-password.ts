import { hash, compare } from "@/lib/bcrypt";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

export class ResetPasswordService {
  async execute(token: string, password: string) {
    // Clean up expired tokens
    await customerAuthRepository.deleteExpiredPasswordResetTokens();

    const tokens = await customerAuthRepository.findAllPasswordResetTokens();

    let foundToken: { id: string; customerId: string; tokenHash: string } | null = null;
    for (const t of tokens) {
      if (await compare(token, t.tokenHash)) {
        foundToken = t;
        break;
      }
    }

    if (!foundToken) {
      const err: any = new Error("Invalid or expired reset token.");
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = await hash(password, 12);
    await customerAuthRepository.updateCustomerPasswordHash(foundToken.customerId, passwordHash);

    // Invalidate every reset token for this customer, not just the used one,
    // so older emailed links cannot be reused afterwards.
    await customerAuthRepository.deletePasswordResetTokensByCustomerId(foundToken.customerId);
  }
}

export const resetPasswordService = new ResetPasswordService();
