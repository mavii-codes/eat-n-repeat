import { getNotificationsService } from "./get-notifications";
import { createNotificationService } from "./create-notification";
import { markAsReadService } from "./mark-as-read";
import { markAllAsReadService } from "./mark-all-as-read";
import { deleteNotificationService } from "./delete-notification";
import { clearAllService } from "./clear-all";

export async function getNotifications(customerId: string) {
  return getNotificationsService.execute(customerId);
}

export async function createNotification(customerId: string, type: string, title: string, description: string) {
  return createNotificationService.execute(customerId, type, title, description);
}

export async function markAsRead(customerId: string, notificationId: string) {
  return markAsReadService.execute(customerId, notificationId);
}

export async function markAllAsRead(customerId: string) {
  return markAllAsReadService.execute(customerId);
}

export async function deleteNotification(customerId: string, notificationId: string) {
  return deleteNotificationService.execute(customerId, notificationId);
}

export async function clearAll(customerId: string) {
  return clearAllService.execute(customerId);
}
