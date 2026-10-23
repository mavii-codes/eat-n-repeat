import { Router } from "express";
import { requireRole } from "@/middleware/requireRole.middleware";
import { adminCustomersController } from "@/controllers/admin-customers.controller";

const router = Router();

// Strictly admin: customers and non-admin staff (staff, head_staff,
// riders) get 403 via requireRole.
router.get("/", requireRole("admin"), (req, res) =>
  adminCustomersController.listCustomers(req, res),
);

router.put("/:id/phone", requireRole("admin"), (req, res) =>
  adminCustomersController.updateCustomerPhone(req, res),
);

export default router;
