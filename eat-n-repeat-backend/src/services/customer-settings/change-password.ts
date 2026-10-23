import { hash, compare } from "@/lib/bcrypt";
import { customerSettingsRepository } from "@/repositories/customer-settings.repository";
import { assertPasswordPolicy } from "@/middleware/security/password-policy";
import { revokeUserTokensBeforeNow } from "@/middleware/security/token-revocations";

export class ChangePasswordService {
  async execute(customerId: string, currentPassword: string, newPassword: string) {
    const policyError = assertPasswordPolicy(newPassword);
    if (policyError) {
      return { error: "weak_password" as const, message: policyError };
    }

    const customer = await customerSettingsRepository.findCustomerPasswordHash(customerId);

    if (!customer) {
      return { error: "not_found" as const };
    }

    const isValid = await compare(currentPassword, customer.passwordHash);
    if (!isValid) {
      return { error: "incorrect_password" as const };
    }

    const newHash = await hash(newPassword, 10);
    await customerSettingsRepository.updateCustomerPassword(customerId, newHash);

    // Every token issued before this instant dies, including the token used
    // for this request. The client must sign in again with the new password.
    revokeUserTokensBeforeNow(customerId);

    return { error: null } as const;
  }
}

export const changePasswordService = new ChangePasswordService();
