import { compare } from "@/lib/bcrypt";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import {
  VERIFICATION_CODE_MAX_ATTEMPTS,
  issueResetAuthorization,
  verificationCodeErrors,
} from "./verification-code";

export class VerifyResetCodeService {
  /**
   * Verifies a password-reset code and, on success, returns a short-lived
   * single-use reset authorization token. The new password can only be set
   * with that token — never on the strength of the frontend's word alone.
   */
  async execute(email: string, code: string): Promise<{ resetToken: string }> {
    const lowerEmail = email.toLowerCase();

    let customer = await customerAuthRepository.findCustomerByEmailWithIdStatusEmail(lowerEmail);
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomersWithIdStatusEmail();
      const found = all.find((c) => c.email.toLowerCase() === lowerEmail);
      if (found) customer = found;
    }

    // Generic failure for every non-verifiable case (anti-enumeration:
    // identical response whether the email exists or not).
    if (!customer || customer.status !== "active") {
      throw verificationCodeErrors.invalidCodeError();
    }

    await customerAuthRepository.deleteExpiredPasswordResetTokens();

    const latest = await customerAuthRepository.findLatestPasswordResetTokenByCustomerId(
      customer.id,
    );
    if (!latest || new Date(latest.expiresAt).getTime() <= Date.now()) {
      throw verificationCodeErrors.expiredCodeError();
    }
    if ((latest.attempts ?? 0) >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      throw verificationCodeErrors.tooManyAttemptsError();
    }

    if (!(await compare(code, latest.tokenHash))) {
      await customerAuthRepository.incrementPasswordResetAttempts(latest.id);
      throw verificationCodeErrors.invalidCodeError();
    }

    // The code itself is single-use: burn every reset row now, then hand
    // out the short-lived reset authorization the password change needs.
    await customerAuthRepository.deletePasswordResetTokensByCustomerId(customer.id);
    return { resetToken: issueResetAuthorization(customer.id) };
  }
}

export const verifyResetCodeService = new VerifyResetCodeService();
