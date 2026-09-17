import { prisma } from "@/lib/prisma";

export class StaffNotificationsRepository {
  async findActiveStaffUsers() {
    return prisma.user.findMany({
      where: {
        role: { in: ["staff", "head_staff", "admin"] },
        status: "active",
      },
      select: { id: true },
    });
  }

  async createStaffNotification(data: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedOrderId?: string | null;
  }) {
    return prisma.staffNotification.create({
      data: {
        id: data.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedOrderId: data.relatedOrderId || null,
      },
    });
  }

  async findAllStaffNotifications() {
    return prisma.staffNotification.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findStaffNotificationById(id: string) {
    return prisma.staffNotification.findUnique({
      where: { id },
      select: { title: true, message: true },
    });
  }

  async updateManyByTitleAndMessage(title: string, message: string) {
    return prisma.staffNotification.updateMany({
      where: { title, message },
      data: { isRead: true },
    });
  }

  async updateManyById(id: string) {
    return prisma.staffNotification.updateMany({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead() {
    return prisma.staffNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }
}

export const staffNotificationsRepository = new StaffNotificationsRepository();
