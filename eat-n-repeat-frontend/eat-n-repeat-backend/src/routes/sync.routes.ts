import { Router } from "express";
import { syncController } from "@/controllers/sync.controller";

const router = Router();

// No auth — server-to-server

router.get("/status", (req, res) => syncController.getStatus(req, res));
router.post("/push", (req, res) => syncController.push(req, res));
router.post("/offline", (req, res) => syncController.offline(req, res));
router.post("/heartbeat", (req, res) => syncController.heartbeat(req, res));

export const syncRouter = router;
export default router;
