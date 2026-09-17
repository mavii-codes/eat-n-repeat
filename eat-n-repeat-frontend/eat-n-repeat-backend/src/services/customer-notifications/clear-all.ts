import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class ClearAllService {
  async execute(customerId: string) {
    await customerNotificationsRepository.clearAll(customerId);
  }
}

export const clearAllService = new ClearAllService();
