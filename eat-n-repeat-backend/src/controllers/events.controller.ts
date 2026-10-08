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
    const identifier = req.params.orderId as string;
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Role is derived server-side so pre-existing JWTs (no `role` claim)
    // keep working without forcing every user to re-login.
    const { orderChatService } = await import("@/services/order-chat");
    const role = await orderChatService.resolveActorRole(userId);
    if (!role) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const orderDbId = await orderChatService.resolveOrderId(identifier);
    if (!orderDbId) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    const hasAccess = await orderChatService.verifyOrderAccess(orderDbId, userId, role);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: "Access denied to this order's chat" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write('data: {"type":"CONNECTED"}\n\n');

    const { addOrderChatSSEClient, removeOrderChatSSEClient } = await import("@/lib/sse");
    addOrderChatSSEClient(orderDbId, res);

    req.on("close", () => {
      removeOrderChatSSEClient(orderDbId, res);
    });
  }
}

export const eventsController = new EventsController();
