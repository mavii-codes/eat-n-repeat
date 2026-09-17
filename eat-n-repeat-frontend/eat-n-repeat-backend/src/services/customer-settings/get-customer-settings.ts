import { customerSettingsRepository } from "@/repositories/customer-settings.repository";

export class GetCustomerSettingsService {
  async execute(customerId: string) {
    return customerSettingsRepository.findCustomerById(customerId);
  }
}

export const getCustomerSettingsService = new GetCustomerSettingsService();
