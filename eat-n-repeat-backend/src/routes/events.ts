import { Router, type Response } from "express";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();
let clients: Response[] = [];

export function emitPaymentEvent(eventData: any) {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

router.get("/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write("data: {\"type\":\"CONNECTED\"}\n\n");

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

export default router;

