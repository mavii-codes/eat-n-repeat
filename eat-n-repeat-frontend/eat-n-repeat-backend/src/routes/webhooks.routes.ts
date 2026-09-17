import { Router } from "express";
import { webhooksController } from "@/controllers/webhooks.controller";

const router = Router();

router.post("/xendit", (req, res) => webhooksController.xenditWebhook(req, res));

export default router;
