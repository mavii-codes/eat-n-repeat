import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class DeleteNotificationService {
  async execute(customerId: string, notificationId: string) {
    await customerNotificationsRepository.deleteNotification(customerId, notificationId);
  }
}

export const deleteNotificationService = new DeleteNotificationService();
