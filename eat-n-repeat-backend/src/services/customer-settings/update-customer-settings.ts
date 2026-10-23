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
    // Phase 3: the mobile number is permanent once saved (first checkout).
    // No customer-facing endpoint may write it — `phone` is always ignored
    // here, even when supplied. Admin-only changes go through the admin
    // customers endpoint with an audit entry.
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.notificationPreferences !== undefined) updateData.notificationPreferences = data.notificationPreferences as any;

    await customerSettingsRepository.updateCustomer(customerId, updateData);
  }
}

export const updateCustomerSettingsService = new UpdateCustomerSettingsService();
