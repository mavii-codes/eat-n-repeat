import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class MarkAsReadService {
  async execute(customerId: string, notificationId: string) {
    await customerNotificationsRepository.markAsRead(customerId, notificationId);
  }
}

export const markAsReadService = new MarkAsReadService();
