import { Router } from "express";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { staffController } from "@/controllers/staff.controller";

const router = Router();

// Staff directory reads are allowed for any staff role (admin, head_staff,
// staff) so POS/staff portals keep working. Customer JWTs are rejected.
// Writes (create/update/delete) are admin-only: a valid staff JWT must NOT
// be able to create Admin accounts or manage users.
router.get("/", requireRole(...STAFF_ROLES), (req, res) =>
  staffController.getAllUsers(req, res),
);
// One-shot friendly temporary password for the Add-staff modal's "Generate"
// option. Admin-only and stateless: the modal sends it back as the new
// account's initial password (or it can be re-generated any time).
router.post("/temp-password", requireRole("admin"), (req, res) =>
  staffController.createTempPassword(req, res),
);
router.post("/", requireRole("admin"), (req, res) =>
  staffController.createUser(req, res),
);
router.put("/:id", requireRole("admin"), (req, res) =>
  staffController.updateUser(req, res),
);
router.delete("/:id", requireRole("admin"), (req, res) =>
  staffController.deleteUser(req, res),
);

export default router;
