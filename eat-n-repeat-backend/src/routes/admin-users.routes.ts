import { Router } from "express";
import { requireRole } from "@/middleware/requireRole.middleware";
import { adminUsersController } from "@/controllers/admin-users.controller";
import { adminFlagsController } from "@/controllers/admin-flags.controller";

const router = Router();

// ── Customer flagging queue (Phase 3) ──
// Static path declared before parameterized flag routes.
router.get("/flags/open-count", requireRole("admin"), (req, res) =>
  adminFlagsController.openCount(req, res),
);
router.get("/flags", requireRole("admin"), (req, res) =>
  adminFlagsController.listFlags(req, res),
);
router.post("/flags/:id/approve", requireRole("admin"), (req, res) =>
  adminFlagsController.approve(req, res),
);
router.post("/flags/:id/dismiss", requireRole("admin"), (req, res) =>
  adminFlagsController.dismiss(req, res),
);
router.post("/flags/:id/watch", requireRole("admin"), (req, res) =>
  adminFlagsController.watch(req, res),
);

// Strictly admin: staff, head_staff and customer JWTs get 403 via requireRole.
router.get("/staff", requireRole("admin"), (req, res) =>
  adminUsersController.listStaff(req, res),
);
router.get("/customers", requireRole("admin"), (req, res) =>
  adminUsersController.listCustomers(req, res),
);
router.get("/activity", requireRole("admin"), (req, res) =>
  adminUsersController.listActivity(req, res),
);

router.post("/staff/:id/disable", requireRole("admin"), (req, res) =>
  adminUsersController.disableStaff(req, res),
);
router.post("/staff/:id/enable", requireRole("admin"), (req, res) =>
  adminUsersController.enableStaff(req, res),
);
router.post("/staff/:id/reset-password", requireRole("admin"), (req, res) =>
  adminUsersController.resetStaffPassword(req, res),
);

// Post-report triage: the ONLY staff-open route on this mount. Admin,
// head_staff and staff may flag; every decision stays admin-only above.
router.post(
  "/customers/:id/report",
  requireRole("admin", "head_staff", "staff"),
  (req, res) => adminFlagsController.reportCustomer(req, res),
);

router.post("/customers/:id/disable", requireRole("admin"), (req, res) =>
  adminUsersController.disableCustomer(req, res),
);
router.post("/customers/:id/enable", requireRole("admin"), (req, res) =>
  adminUsersController.enableCustomer(req, res),
);

export default router;
