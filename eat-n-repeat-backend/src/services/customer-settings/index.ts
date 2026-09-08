import { getCustomerSettingsService } from "./get-customer-settings";
import { updateCustomerSettingsService } from "./update-customer-settings";
import { changePasswordService } from "./change-password";
import { deleteAccountService } from "./delete-account";

export async function getCustomerSettings(customerId: string) {
  return getCustomerSettingsService.execute(customerId);
}

export async function updateCustomerSettings(
  customerId: string,
  data: {
    name?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    notificationPreferences?: unknown;
  },
) {
  return updateCustomerSettingsService.execute(customerId, data);
}

export async function changePassword(customerId: string, currentPassword: string, newPassword: string) {
  return changePasswordService.execute(customerId, currentPassword, newPassword);
}

export async function deleteAccount(customerId: string) {
  return deleteAccountService.execute(customerId);
}
