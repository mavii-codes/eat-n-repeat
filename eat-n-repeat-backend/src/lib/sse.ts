import type { Response } from "express";

let clients: Response[] = [];

export function emitPaymentEvent(eventData: any) {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

export function addSSEClient(client: Response) {
  clients.push(client);
}

export function removeSSEClient(client: Response) {
  clients = clients.filter((c) => c !== client);
}
