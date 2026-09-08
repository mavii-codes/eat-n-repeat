import { staffNotificationsRepository } from "@/repositories/staff-notifications.repository";
import { v4 as uuidv4 } from "uuid";

export async function notifyAllStaff(type: string, title: string, message: string, relatedOrderId?: string) {
  const activeStaff = await staffNotificationsRepository.findActiveStaffUsers();

  const notifications = activeStaff.map((staff) => ({
    id: uuidv4(),
    userId: staff.id,
    type,
    title,
    message,
    relatedOrderId: relatedOrderId || null,
  }));

  for (const notification of notifications) {
    await staffNotificationsRepository.createStaffNotification(notification);
  }
}

export async function getStaffNotifications() {
  return staffNotificationsRepository.findAllStaffNotifications();
}

export async function markNotificationAsRead(id: string) {
  const notification = await staffNotificationsRepository.findStaffNotificationById(id);
  if (!notification) {
    throw Object.assign(new Error("Notification not found"), { status: 404 });
  }

  await staffNotificationsRepository.updateManyById(id);
}

export async function markAllAsRead() {
  await staffNotificationsRepository.markAllAsRead();
}
