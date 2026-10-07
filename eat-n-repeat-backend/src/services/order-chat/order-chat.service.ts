import { v4 as uuidv4 } from "uuid";
import { orderChatRepository } from "@/repositories/order-chat.repository";
import { prisma } from "@/lib/prisma";
import { emitOrderChatEvent } from "@/lib/sse";

export class OrderChatService {
  async verifyOrderAccess(orderId: string, userId: string, role: string): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true, assignedRole: true, deliveryPerson: true },
    });

    if (!order) return false;

    if (role === "customer") {
      return order.customerId === userId;
    }

    // Staff/admin: allow if they are the assigned delivery person, or if they are admin/head_staff
    if (["admin", "head_staff", "staff"].includes(role)) {
      return true;
    }

    return false;
  }

  async getMessages(orderId: string, limit = 100, before?: Date) {
    return orderChatRepository.findMessagesByOrderId(orderId, limit, before);
  }

  async sendMessage(data: {
    orderId: string;
    senderId: string;
    senderRole: "customer" | "staff";
    message: string;
  }) {
    const id = uuidv4();
    const message = await orderChatRepository.createMessage({
      id,
      orderId: data.orderId,
      senderId: data.senderId,
      senderRole: data.senderRole,
      message: data.message,
    });

    // Emit realtime event
    await this.emitNewMessage(data.orderId, message);

    return message;
  }

  async markAsRead(orderId: string, userId: string, role: "customer" | "staff") {
    return orderChatRepository.markMessagesAsRead(orderId, userId, role);
  }

  async getUnreadCount(orderId: string, userId: string, role: "customer" | "staff") {
    return orderChatRepository.getUnreadCount(orderId, userId, role);
  }

  async emitNewMessage(orderId: string, message: any) {
    try {
      await emitOrderChatEvent(orderId, {
        type: "NEW_MESSAGE",
        message,
      });
    } catch (error) {
      console.error("Failed to emit order chat event:", error);
    }
  }
}

export const orderChatService = new OrderChatService();