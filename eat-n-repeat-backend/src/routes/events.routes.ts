import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { eventsController } from "@/controllers/events.controller";

const router = Router();

router.get("/stream", requireAuth, (req, res) => eventsController.stream(req, res));
router.get("/order-chat/:orderId/stream", requireAuth, (req, res) => eventsController.streamOrderChat(req, res));

export default router;
