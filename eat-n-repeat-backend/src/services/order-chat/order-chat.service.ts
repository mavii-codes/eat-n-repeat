import { v4 as uuidv4 } from "uuid";
import { orderChatRepository } from "@/repositories/order-chat.repository";
import { prisma } from "@/lib/prisma";
import { emitOrderChatEvent } from "@/lib/sse";

export type ChatActorRole = "customer" | "staff";

export class OrderChatService {
  /**
   * Resolve the caller's chat role server-side so existing JWTs (which
   * carry no `role` claim) keep working. Staff users table wins; otherwise
   * a matching customer row means the customer role.
   */
  async resolveActorRole(userId: string): Promise<ChatActorRole | null> {
    const staffUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (staffUser) return "staff";
    const customer = await prisma.customer.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (customer) return "customer";
    return null;
  }

  /**
   * Resolve an order identifier to its database id. Accepts a primary key
   * first; falls back to order numbers (walk-in twins can share a number,
   * so prefer the real customer-owned row — same rule as the payments flow).
   */
  async resolveOrderId(identifier: string): Promise<string | null> {
    const byId = await prisma.order.findUnique({
      where: { id: identifier },
      select: { id: true },
    });
    if (byId) return byId.id;
    const matches = await prisma.order.findMany({
      where: { orderNumber: identifier },
      select: { id: true, customerId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (matches.length === 0) return null;
    return (matches.find((o) => o.customerId) ?? matches[0]).id;
  }

  async verifyOrderAccess(orderDbId: string, userId: string, role: ChatActorRole): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderDbId },
      select: { customerId: true },
    });

    if (!order) return false;

    if (role === "customer") {
      return order.customerId === userId;
    }

    // Staff/admin/riders: authorized under the existing staff system.
    return true;
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
