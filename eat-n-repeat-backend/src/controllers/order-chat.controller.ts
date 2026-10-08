import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { orderChatService } from "@/services/order-chat";

async function authorizeOrderChat(req: AuthenticatedRequest) {
  const userId = req.auth?.userId;
  if (!userId) return { error: "Unauthorized" as const };
  // Role is derived server-side so pre-existing JWTs (no `role` claim)
  // keep working without forcing every user to re-login.
  const role = await orderChatService.resolveActorRole(userId);
  if (!role) return { error: "Unauthorized" as const };
  return { userId, role };
}

export class OrderChatController {
  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const identifier = req.params.orderId as string;
      const auth = await authorizeOrderChat(req);
      if ("error" in auth) {
        return res.status(401).json({ success: false, message: auth.error });
      }

      const orderDbId = await orderChatService.resolveOrderId(identifier);
      if (!orderDbId) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      const hasAccess = await orderChatService.verifyOrderAccess(orderDbId, auth.userId, auth.role);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      }

      const messages = await orderChatService.getMessages(orderDbId);
      res.json({ success: true, messages });
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const identifier = req.params.orderId as string;
      const { message } = req.body;
      if (typeof message !== "string" || !message.trim() || message.trim().length > 2000) {
        return res.status(400).json({ success: false, message: "Message must be 1-2000 characters." });
      }
      const auth = await authorizeOrderChat(req);
      if ("error" in auth) {
        return res.status(401).json({ success: false, message: auth.error });
      }

      const orderDbId = await orderChatService.resolveOrderId(identifier);
      if (!orderDbId) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      const hasAccess = await orderChatService.verifyOrderAccess(orderDbId, auth.userId, auth.role);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      }

      const newMessage = await orderChatService.sendMessage({
        orderId: orderDbId,
        senderId: auth.userId,
        senderRole: auth.role,
        message: message.trim(),
      });

      res.json({ success: true, message: newMessage });
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      if (error.status === 403) {
        return res.status(403).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const identifier = req.params.orderId as string;
      const auth = await authorizeOrderChat(req);
      if ("error" in auth) {
        return res.status(401).json({ success: false, message: auth.error });
      }

      const orderDbId = await orderChatService.resolveOrderId(identifier);
      if (!orderDbId) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      await orderChatService.markAsRead(orderDbId, auth.userId, auth.role);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response) {
    try {
      const identifier = req.params.orderId as string;
      const auth = await authorizeOrderChat(req);
      if ("error" in auth) {
        return res.status(401).json({ success: false, message: auth.error });
      }

      const orderDbId = await orderChatService.resolveOrderId(identifier);
      if (!orderDbId) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      const count = await orderChatService.getUnreadCount(orderDbId, auth.userId, auth.role);
      res.json({ success: true, unreadCount: count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const orderChatController = new OrderChatController();
