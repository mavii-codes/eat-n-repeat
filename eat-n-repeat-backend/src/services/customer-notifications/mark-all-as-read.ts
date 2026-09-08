import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class MarkAllAsReadService {
  async execute(customerId: string) {
    await customerNotificationsRepository.markAllAsRead(customerId);
  }
}

export const markAllAsReadService = new MarkAllAsReadService();
