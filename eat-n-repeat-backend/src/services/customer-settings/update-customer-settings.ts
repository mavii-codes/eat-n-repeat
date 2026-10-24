import { customerSettingsRepository } from "@/repositories/customer-settings.repository";
import { normalizePhoneNumber, isValidPhoneNumber, phoneFormatMessage } from "@/services/customer-phone";

export class CustomerSettingsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

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

    if (data.phone !== undefined) {
      if (!data.phone || data.phone.trim() === "") {
        updateData.phone = null;
      } else {
        const normalized = normalizePhoneNumber(data.phone);
        if (!isValidPhoneNumber(normalized)) {
          throw new CustomerSettingsError(phoneFormatMessage(), 400);
        }
        updateData.phone = normalized;
      }
    }

    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.notificationPreferences !== undefined) updateData.notificationPreferences = data.notificationPreferences as any;

    await customerSettingsRepository.updateCustomer(customerId, updateData);
  }
}

export const updateCustomerSettingsService = new UpdateCustomerSettingsService();
