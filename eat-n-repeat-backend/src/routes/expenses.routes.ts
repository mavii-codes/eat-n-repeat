import { Router } from "express";
import { requireRole } from "@/middleware/requireRole.middleware";
import { expensesController } from "@/controllers/expenses.controller";

const router = Router();

router.get("/", requireRole("admin"), (req, res) =>
  expensesController.listExpenses(req, res),
);
router.get("/summary", requireRole("admin"), (req, res) =>
  expensesController.summary(req, res),
);
router.post("/", requireRole("admin"), (req, res) =>
  expensesController.createExpense(req, res),
);
router.post("/:id/void", requireRole("admin"), (req, res) =>
  expensesController.voidExpense(req, res),
);
router.post("/:id/reverse", requireRole("admin"), (req, res) =>
  expensesController.reverseExpense(req, res),
);

export default router;
