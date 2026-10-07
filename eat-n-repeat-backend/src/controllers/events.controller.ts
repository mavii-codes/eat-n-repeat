import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as service from "@/services/events";

export class EventsController {
  async stream(req: AuthenticatedRequest, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write('data: {"type":"CONNECTED"}\n\n');

    service.addSSEClient(res);

    req.on("close", () => {
      service.removeSSEClient(res);
    });
  }

  async streamOrderChat(req: AuthenticatedRequest, res: Response) {
    const orderId = req.params.orderId as string;
    const userId = req.auth?.userId;
    const role = req.auth?.role;

    if (!userId || !role) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Verify access to this order's chat
    const { orderChatService } = await import("@/services/order-chat");
    const hasAccess = await orderChatService.verifyOrderAccess(orderId, userId, role);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write('data: {"type":"CONNECTED"}\n\n');

    const { addOrderChatSSEClient, removeOrderChatSSEClient } = await import("@/lib/sse");
    addOrderChatSSEClient(orderId, res);

    req.on("close", () => {
      removeOrderChatSSEClient(orderId, res);
    });
  }
}

export const eventsController = new EventsController();
