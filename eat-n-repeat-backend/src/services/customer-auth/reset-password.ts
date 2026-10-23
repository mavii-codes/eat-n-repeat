import { hash, compare } from "@/lib/bcrypt";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import { assertPasswordPolicy } from "@/middleware/security/password-policy";
import { revokeUserTokensBeforeNow } from "@/middleware/security/token-revocations";
import { consumeResetAuthorization } from "./verification-code";

export class ResetPasswordService {
  /**
   * Resets the password with EITHER:
   * - resetToken: short-lived single-use authorization issued by
   *   verify-reset-code after a 6-digit code check (new code flow), or
   * - token: a legacy emailed reset link token (kept working until such
   *   links expire; forgot-password no longer issues them).
   * One of the two is required; both are single-use server-side secrets.
   */
  async execute(input: { token?: string; resetToken?: string; password: string }) {
    const { token, resetToken, password } = input;

    // Validate before consuming a single-use reset authorization so a weak
    // password retry does not burn the customer's code/link.
    const policyError = assertPasswordPolicy(password);
    if (policyError) {
      const err: any = new Error(policyError);
      err.statusCode = 400;
      throw err;
    }

    if (resetToken) {
      const customerId = consumeResetAuthorization(resetToken);
      if (!customerId) {
        const err: any = new Error("Invalid or expired reset token.");
        err.statusCode = 400;
        throw err;
      }
      const passwordHash = await hash(password, 12);
      await customerAuthRepository.updateCustomerPasswordHash(customerId, passwordHash);
      // Burn any leftover reset rows too: no emailed code may outlive this.
      await customerAuthRepository.deletePasswordResetTokensByCustomerId(customerId);
      // Password changes invalidate every existing session for this customer.
      revokeUserTokensBeforeNow(customerId);
      return;
    }

    if (!token) {
      const err: any = new Error("Invalid or expired reset token.");
      err.statusCode = 400;
      throw err;
    }

    // Legacy link-token path (unchanged behavior).
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

    // Password changes invalidate every existing session for this customer.
    revokeUserTokensBeforeNow(foundToken.customerId);
  }
}

export const resetPasswordService = new ResetPasswordService();
