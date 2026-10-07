import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { orderChatService } from "@/services/order-chat";

export class OrderChatController {
  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const userId = req.auth?.userId;
      const role = req.auth?.role as "customer" | "staff";

      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // Verify user has access to this order's chat
      const hasAccess = await orderChatService.verifyOrderAccess(orderId, userId, role);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      }

      const messages = await orderChatService.getMessages(orderId);
      res.json({ success: true, messages });
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const { message } = req.body;
      const userId = req.auth?.userId;
      const role = req.auth?.role as "customer" | "staff";

      if (!userId || !role) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // Verify user has access to this order's chat
      const hasAccess = await orderChatService.verifyOrderAccess(orderId, userId, role);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      }

      const senderRole = role === "customer" ? "customer" : "staff";
      const newMessage = await orderChatService.sendMessage({
        orderId,
        senderId: userId,
        senderRole,
        message,
      });

      // Emit realtime event via SSE
      await orderChatService.emitNewMessage(orderId, newMessage);

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
      const orderId = req.params.orderId as string;
      const userId = req.auth?.userId;
      const role = req.auth?.role as "customer" | "staff";

      if (!userId || !role) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      await orderChatService.markAsRead(orderId, userId, role);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const userId = req.auth?.userId;
      const role = req.auth?.role as "customer" | "staff";

      if (!userId || !role) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const count = await orderChatService.getUnreadCount(orderId, userId, role);
      res.json({ success: true, unreadCount: count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export const orderChatController = new OrderChatController();