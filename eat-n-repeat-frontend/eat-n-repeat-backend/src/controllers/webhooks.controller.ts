import type { Request, Response } from "express";
import { env } from "@/config/env";
import * as service from "@/services/webhooks";

export class WebhooksController {
  async xenditWebhook(req: Request, res: Response) {
    try {
      const webhookToken = req.headers["x-callback-token"] as string | undefined;

      // Verify webhook token if configured
      if (env.xendit.webhookToken && webhookToken !== env.xendit.webhookToken) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }

      const event = req.body;

      await service.handleXenditWebhook(event);

      res.status(200).send("Webhook received");
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  }
}

export const webhooksController = new WebhooksController();
