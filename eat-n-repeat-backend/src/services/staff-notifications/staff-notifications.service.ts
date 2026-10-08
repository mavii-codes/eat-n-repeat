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
  const rows = await staffNotificationsRepository.findAllStaffNotifications();
  // Map Prisma camelCase fields to the frontend's snake_case contract.
  // The frontend StaffNotification type expects: id, user_id, type, title,
  // message, related_order_id, is_read, created_at. Prisma returns camelCase.
  return rows.map((n) => ({
    id: n.id,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    related_order_id: n.relatedOrderId,
    is_read: n.isRead,
    created_at: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
  }));
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
