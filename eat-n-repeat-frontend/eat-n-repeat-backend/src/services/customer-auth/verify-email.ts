import { compare } from "@/lib/bcrypt";
import { customerAuthRepository } from "@/repositories/customer-auth.repository";

export class VerifyEmailService {
  async execute(token: string) {
    if (!token) {
      const err: any = new Error("Invalid or missing token.");
      err.statusCode = 400;
      throw err;
    }

    await customerAuthRepository.deleteExpiredEmailVerificationTokens();

    const tokens = await customerAuthRepository.findAllEmailVerificationTokens();

    let foundToken: { id: string; customerId: string; tokenHash: string } | null = null;
    for (const t of tokens) {
      if (await compare(token, t.tokenHash)) {
        foundToken = t;
        break;
      }
    }

    if (!foundToken) {
      const err: any = new Error("Invalid or expired verification token.");
      err.statusCode = 400;
      throw err;
    }

    await customerAuthRepository.updateCustomerStatusById(foundToken.customerId, "active");

    await customerAuthRepository.deleteEmailVerificationTokenById(foundToken.id);
  }
}

export const verifyEmailService = new VerifyEmailService();
