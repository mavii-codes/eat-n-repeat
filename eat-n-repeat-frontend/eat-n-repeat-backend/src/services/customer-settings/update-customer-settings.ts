import { customerSettingsRepository } from "@/repositories/customer-settings.repository";

export class UpdateCustomerSettingsService {
  async execute(
    customerId: string,
    data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      notificationPreferences?: unknown;
    }
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.notificationPreferences !== undefined) updateData.notificationPreferences = data.notificationPreferences as any;

    await customerSettingsRepository.updateCustomer(customerId, updateData);
  }
}

export const updateCustomerSettingsService = new UpdateCustomerSettingsService();
