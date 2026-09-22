import type { Request, Response } from "express";
import { env } from "@/config/env";
import * as service from "@/services/webhooks";

export class WebhooksController {
  async xenditWebhook(req: Request, res: Response) {
    try {
      const webhookToken = req.headers["x-callback-token"] as string | undefined;

      // Fail closed in production: without a configured token we cannot
      // authenticate the sender. In non-production, warn and allow (local testing).
      if (!env.xendit.webhookToken) {
        if (env.nodeEnv === "production") {
          return res.status(401).json({ error: "Webhook not configured" });
        }
        console.warn("[webhooks] XENDIT_WEBHOOK_TOKEN unset — accepting unsigned webhook (development only).");
      } else if (webhookToken !== env.xendit.webhookToken) {
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
