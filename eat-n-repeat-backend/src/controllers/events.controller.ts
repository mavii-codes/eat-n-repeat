import type { Request, Response } from "express";
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

  // Admin-only invalidation stream. Payloads are intentionally tiny
  // ({ type, at }): subscribers revalidate their own admin-scoped data.
  async adminStreamHandler(req: AuthenticatedRequest, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    // Send headers immediately so proxies/browsers see the stream open.
    res.flushHeaders();

    // Initial reconnect hint + connection ack, same shape as the other streams.
    res.write("retry: 15000\n\n");
    res.write('data: {"type":"CONNECTED"}\n\n');

    const { addAdminSSEClient, removeAdminSSEClient, startSSEKeepAlive } =
      await import("@/lib/sse");
    addAdminSSEClient(res);

    const stopKeepAlive = startSSEKeepAlive(res, {
      removeClient: removeAdminSSEClient,
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      stopKeepAlive();
      removeAdminSSEClient(res);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  }

  // Public read-only review stream (guests included). The payload carries
  // only public review data — the same fields the review list UI already
  // displays — so no authentication is required and none of the existing
  // authenticated streams are loosened.
  async streamReviewEvents(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Send headers immediately so proxies/browsers see the stream open
    // instead of waiting for the first body write.
    res.flushHeaders();

    res.write('data: {"type":"CONNECTED"}\n\n');

    const { addReviewSSEClient, removeReviewSSEClient, startSSEKeepAlive } =
      await import("@/lib/sse");
    addReviewSSEClient(res);

    // Periodic comment lines keep the stream alive through the Next proxy's
    // upstream idle timeout. The returned cleanup clears the interval.
    const stopKeepAlive = startSSEKeepAlive(res, {
      removeClient: removeReviewSSEClient,
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      stopKeepAlive();
      removeReviewSSEClient(res);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  }

  async streamOrderChat(req: AuthenticatedRequest, res: Response) {    const identifier = req.params.orderId as string;
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
