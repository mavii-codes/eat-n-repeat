import { prisma } from "@/lib/prisma";

export class OrderChatRepository {
  async createMessage(data: {
    id: string;
    orderId: string;
    senderId: string;
    senderRole: "customer" | "staff";
    message: string;
  }) {
    return prisma.orderChatMessage.create({
      data: {
        id: data.id,
        orderId: data.orderId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        message: data.message,
      },
    });
  }

  async findMessagesByOrderId(orderId: string, limit = 100, before?: Date) {
    return prisma.orderChatMessage.findMany({
      where: {
        orderId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async findLatestMessageByOrderId(orderId: string) {
    return prisma.orderChatMessage.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  }

  async markMessagesAsRead(orderId: string, userId: string, role: "customer" | "staff") {
    return prisma.orderChatMessage.updateMany({
      where: {
        orderId,
        senderId: { not: userId },
        senderRole: role === "customer" ? "staff" : "customer",
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async getUnreadCount(orderId: string, userId: string, role: "customer" | "staff") {
    return prisma.orderChatMessage.count({
      where: {
        orderId,
        senderId: { not: userId },
        senderRole: role === "customer" ? "staff" : "customer",
        isRead: false,
      },
    });
  }
}

export const orderChatRepository = new OrderChatRepository();