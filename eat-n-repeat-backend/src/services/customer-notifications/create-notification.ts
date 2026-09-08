import crypto from "crypto";
import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class CreateNotificationService {
  async execute(customerId: string, type: string, title: string, description: string) {
    const id = `note-${crypto.randomUUID().slice(0, 8)}`;
    await customerNotificationsRepository.createNotification({ id, customerId, type, title, description });
    return id;
  }
}

export const createNotificationService = new CreateNotificationService();
