import { customerNotificationsRepository } from "@/repositories/customer-notifications.repository";

export class GetNotificationsService {
  async execute(customerId: string) {
    return customerNotificationsRepository.findManyByCustomerId(customerId);
  }
}

export const getNotificationsService = new GetNotificationsService();
