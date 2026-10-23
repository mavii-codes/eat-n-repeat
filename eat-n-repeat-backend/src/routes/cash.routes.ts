import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { cashController } from "@/controllers/cash.controller";

const router = Router();

router.get("/shift/current", requireRole(...STAFF_ROLES), (req, res) =>
  cashController.getCurrentShift(req, res),
);
router.post("/shift/start", requireRole(...STAFF_ROLES), (req, res) =>
  cashController.startShift(req, res),
);
router.post("/shift/end", requireRole(...STAFF_ROLES), (req, res) =>
  cashController.endShift(req, res),
);
router.get("/shifts", requireAuth, (req, res) => cashController.getAllShifts(req, res));
router.get("/pos-sales/today", requireRole(...STAFF_ROLES), (req, res) => cashController.getPosSalesToday(req, res));
router.get("/shifts/:id", requireAuth, (req, res) => cashController.getShiftDetails(req, res));
router.post("/shifts/:id/verify", requireAuth, (req, res) => cashController.verifyShift(req, res));
router.post("/shifts/:id/flag", requireAuth, (req, res) => cashController.flagShift(req, res));
router.post("/shifts/:id/audit-signoff", requireAuth, (req, res) => cashController.editAuditSignoff(req, res));
router.post("/shifts/:id/signoff", requireAuth, (req, res) => cashController.editAuditSignoff(req, res));
router.put("/shifts/:id/audit-signoff", requireAuth, (req, res) => cashController.editAuditSignoff(req, res));
router.put("/shifts/:id/signoff", requireAuth, (req, res) => cashController.editAuditSignoff(req, res));
router.post("/shifts/:id/add-float", requireAuth, (req, res) => cashController.addFloat(req, res));
router.post("/shifts/:id/expense", requireAuth, (req, res) => cashController.addShiftExpense(req, res));

export default router;
