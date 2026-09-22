import { Router } from "express";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { staffController } from "@/controllers/staff.controller";

const router = Router();

// All staff user-management routes require a staff-role JWT
// (admin, head_staff, or staff). Customer JWTs are rejected.
router.use(requireRole(...STAFF_ROLES));

router.get("/", (req, res) => staffController.getAllUsers(req, res));
router.post("/", (req, res) => staffController.createUser(req, res));
router.put("/:id", (req, res) => staffController.updateUser(req, res));
router.delete("/:id", (req, res) => staffController.deleteUser(req, res));

export default router;
