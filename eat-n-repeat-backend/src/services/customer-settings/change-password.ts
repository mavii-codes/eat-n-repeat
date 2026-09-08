import { hash, compare } from "@/lib/bcrypt";
import { customerSettingsRepository } from "@/repositories/customer-settings.repository";

export class ChangePasswordService {
  async execute(customerId: string, currentPassword: string, newPassword: string) {
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

    return { error: null } as const;
  }
}

export const changePasswordService = new ChangePasswordService();
