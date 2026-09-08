import { prisma } from "@/lib/prisma";

export class CustomerNotificationsRepository {
  async findManyByCustomerId(customerId: string) {
    return prisma.customerNotification.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createNotification(data: { id: string; customerId: string; type: string; title: string; description: string }) {
    return prisma.customerNotification.create({
      data,
    });
  }

  async markAsRead(customerId: string, notificationId: string) {
    return prisma.customerNotification.updateMany({
      where: { id: notificationId, customerId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(customerId: string) {
    return prisma.customerNotification.updateMany({
      where: { customerId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(customerId: string, notificationId: string) {
    return prisma.customerNotification.deleteMany({
      where: { id: notificationId, customerId },
    });
  }

  async clearAll(customerId: string) {
    return prisma.customerNotification.deleteMany({
      where: { customerId },
    });
  }
}

export const customerNotificationsRepository = new CustomerNotificationsRepository();
