import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerAddressesController } from "@/controllers/customer-addresses.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerAddressesController.getAddresses(req, res));
router.post("/", requireAuth, (req, res) => customerAddressesController.createAddress(req, res));
router.put("/:id/default", requireAuth, (req, res) => customerAddressesController.setDefaultAddress(req, res));
router.put("/:id", requireAuth, (req, res) => customerAddressesController.updateAddress(req, res));
router.delete("/:id", requireAuth, (req, res) => customerAddressesController.deleteAddress(req, res));

export default router;
