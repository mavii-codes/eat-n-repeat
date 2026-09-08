import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { staffController } from "@/controllers/staff.controller";

const router = Router();

// All routes require auth (mirrors old router.use(requireAuth))
router.use(requireAuth);

router.get("/", (req, res) => staffController.getAllUsers(req, res));
router.post("/", (req, res) => staffController.createUser(req, res));
router.put("/:id", (req, res) => staffController.updateUser(req, res));
router.delete("/:id", (req, res) => staffController.deleteUser(req, res));

export default router;
