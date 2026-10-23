import type { Response } from "express";

let paymentClients: Response[] = [];
let orderChatClients: Map<string, Response[]> = new Map();
// Global review channel: every subscriber receives every review event and
// ignores items it is not viewing (client-side filter). The payload carries
// only public data (same fields the review list UI already displays), so
// this stream is safe for guests. Customer-specific myRating/hasReviewed
// are never broadcast — viewers derive those from their own data.

/**
 * Payment stream payload allowlist. The stream is staff-only and has no
 * frontend consumer; only non-PII routing fields cross it (customer UI polls
 * /customer-orders instead). Never add customerName/phone/address/items or
 * monetary values here.
 */
export type PaymentBroadcastEvent = {
  type: string;
  at: string;
  orderId: string | null;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
};

export function emitPaymentEvent(eventData: PaymentBroadcastEvent) {
  // Rebuild from the allowlist so extra properties on the caller object can
  // never leak customer data.
  const payload: PaymentBroadcastEvent = {
    type: eventData.type,
    at: eventData.at,
    orderId: eventData.orderId,
    orderNumber: eventData.orderNumber,
    status: eventData.status,
    paymentStatus: eventData.paymentStatus,
  };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of [...paymentClients]) {
    try {
      client.write(data);
    } catch (error) {
      console.error("Failed to write to payment SSE client:", error);
      removePaymentSSEClient(client);
    }
  }
}

export function addPaymentSSEClient(client: Response) {
  paymentClients.push(client);
}

export function removePaymentSSEClient(client: Response) {
  paymentClients = paymentClients.filter((c) => c !== client);
}

// Admin dashboard channel: tiny invalidation events only (type + timestamp).
// Subscribers refetch their own admin-scoped data; no order/customer payload
// ever crosses this stream.
let adminClients: Response[] = [];

export function emitAdminEvent(eventData: { type: string; at: string }) {
  const data = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of [...adminClients]) {
    try {
      client.write(data);
    } catch (error) {
      console.error("Failed to write to admin SSE client:", error);
      removeAdminSSEClient(client);
    }
  }
}

export function addAdminSSEClient(client: Response) {
  adminClients.push(client);
}

export function removeAdminSSEClient(client: Response) {
  adminClients = adminClients.filter((c) => c !== client);
}

export function addOrderChatSSEClient(orderId: string, client: Response) {
  if (!orderChatClients.has(orderId)) {
    orderChatClients.set(orderId, []);
  }
  orderChatClients.get(orderId)!.push(client);
}

export function removeOrderChatSSEClient(orderId: string, client: Response) {
  const clients = orderChatClients.get(orderId);
  if (clients) {
    const index = clients.indexOf(client);
    if (index !== -1) {
      clients.splice(index, 1);
    }
    if (clients.length === 0) {
      orderChatClients.delete(orderId);
    }
  }
}

export async function emitOrderChatEvent(orderId: string, eventData: any) {
  const clients = orderChatClients.get(orderId);
  if (clients) {
    const data = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of [...clients]) {
      try {
        client.write(data);
      } catch (error) {
        console.error("Failed to write to SSE client:", error);
        removeOrderChatSSEClient(orderId, client);
      }
    }
  }
}

let reviewClients: Response[] = [];

export function addReviewSSEClient(client: Response) {
  reviewClients.push(client);
}

export function removeReviewSSEClient(client: Response) {
  reviewClients = reviewClients.filter((c) => c !== client);
}

type SSEKeepAliveOptions = {
  intervalMs?: number;
  // Called once if the heartbeat write fails (or the response is already
  // closed), so the caller can evict the dead client from its registry.
  removeClient?: (client: Response) => void;
};

// Sends an SSE comment line on an interval to keep the connection (and any
// intermediary proxy) from timing out during quiet periods. Returns an
// idempotent cleanup that clears the interval; callers must invoke it on
// request/response close and on errors.
export function startSSEKeepAlive(
  res: Response,
  opts: SSEKeepAliveOptions = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 15_000;
  let stopped = false;
  let timer: NodeJS.Timeout;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };

  timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      stop();
      opts.removeClient?.(res);
      return;
    }
    try {
      res.write(": keep-alive\n\n");
    } catch (error) {
      console.error("Failed to write SSE keep-alive:", error);
      stop();
      opts.removeClient?.(res);
    }
  }, intervalMs);
  // Keep-alive timers must not keep the process alive on their own.
  timer.unref?.();

  return stop;
}

export type ReviewBroadcastEvent = {
  type: "REVIEW_CREATED" | "REVIEW_UPDATED" | "REVIEW_DELETED";
  menuItemId: string;
  averageRating: number;
  ratingCount: number;
  // Present for CREATED/UPDATED; DELETED carries reviewId instead.
  // Public fields only: id, rating, comment, displayName, createdAt.
  review?: {
    id: string;
    rating: number;
    comment: string;
    displayName: string;
    createdAt: string;
  };
  reviewId?: string;
};

export async function emitReviewEvent(eventData: ReviewBroadcastEvent) {
  const data = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of [...reviewClients]) {
    try {
      client.write(data);
    } catch (error) {
      console.error("Failed to write to review SSE client:", error);
      removeReviewSSEClient(client);
    }
  }
}
