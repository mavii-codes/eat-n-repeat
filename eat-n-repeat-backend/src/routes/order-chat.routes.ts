import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { orderChatController } from "@/controllers/order-chat.controller";

const router = Router();

router.get("/:orderId/messages", requireAuth, (req, res) => orderChatController.getMessages(req, res));
router.post("/:orderId/messages", requireAuth, (req, res) => orderChatController.sendMessage(req, res));
router.post("/:orderId/messages/read", requireAuth, (req, res) => orderChatController.markAsRead(req, res));
router.get("/:orderId/unread-count", requireAuth, (req, res) => orderChatController.getUnreadCount(req, res));

export default router;