import type { Response } from "express";

let paymentClients: Response[] = [];
let orderChatClients: Map<string, Response[]> = new Map();

export function emitPaymentEvent(eventData: any) {
  paymentClients.forEach((client) => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

export function addPaymentSSEClient(client: Response) {
  paymentClients.push(client);
}

export function removePaymentSSEClient(client: Response) {
  paymentClients = paymentClients.filter((c) => c !== client);
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
    for (const client of clients) {
      try {
        client.write(data);
      } catch (error) {
        console.error("Failed to write to SSE client:", error);
      }
    }
  }
}
