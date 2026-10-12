import { compare } from "@/lib/bcrypt";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";
import {
  VERIFICATION_CODE_MAX_ATTEMPTS,
  verificationCodeErrors,
} from "./verification-code";

export class VerifyEmailCodeService {
  async execute(email: string, code: string) {
    const lowerEmail = email.toLowerCase();

    let customer = await customerAuthRepository.findCustomerByEmailWithIdStatus(lowerEmail);
    if (!customer) {
      const all = await customerAuthRepository.findAllCustomersWithIdStatusEmail();
      const found = all.find((c) => c.email.toLowerCase() === lowerEmail);
      if (found) customer = { id: found.id, status: found.status } as any;
    }

    // Generic failure for every non-verifiable case: never reveal whether
    // the email exists, is already verified, or has a pending code.
    if (!customer || customer.status !== "pending_verification") {
      throw verificationCodeErrors.invalidCodeError();
    }

    await customerAuthRepository.deleteExpiredEmailVerificationTokens();

    const latest = await customerAuthRepository.findLatestEmailVerificationTokenByCustomerId(
      customer.id,
    );
    if (!latest || new Date(latest.expiresAt).getTime() <= Date.now()) {
      throw verificationCodeErrors.expiredCodeError();
    }
    if ((latest.attempts ?? 0) >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      throw verificationCodeErrors.tooManyAttemptsError();
    }

    if (!(await compare(code, latest.tokenHash))) {
      await customerAuthRepository.incrementEmailVerificationAttempts(latest.id);
      throw verificationCodeErrors.invalidCodeError();
    }

    await customerAuthRepository.updateCustomerStatusById(customer.id, "active");

    // Single-use: every code for this customer dies with the success,
    // so older emailed codes cannot be reused afterwards.
    await customerAuthRepository.deleteEmailVerificationTokensByCustomerId(customer.id);
  }
}

export const verifyEmailCodeService = new VerifyEmailCodeService();
