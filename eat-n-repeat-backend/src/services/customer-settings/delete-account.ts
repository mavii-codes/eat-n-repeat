import { customerSettingsRepository } from "@/repositories/customer-settings.repository";

export class DeleteAccountService {
  async execute(customerId: string) {
    await customerSettingsRepository.deleteCustomer(customerId);
  }
}

export const deleteAccountService = new DeleteAccountService();
