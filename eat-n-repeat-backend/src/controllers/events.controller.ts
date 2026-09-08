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
}

export const eventsController = new EventsController();
