import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import {
  adminExpenseSchema,
  expenseActionReasonSchema,
  expenseSummaryQuerySchema,
  listExpensesQuerySchema,
} from "@/schema/expenses/expenses.schema";
import {
  createAdminExpenseService,
  ExpenseServiceError,
  getExpenseSummaryService,
  listExpensesService,
  reverseExpenseService,
  voidExpenseService,
} from "@/services/expenses/index";

function expenseFailure(
  res: Response,
  error: unknown,
  context: string,
): Response {
  if (error instanceof ExpenseServiceError) {
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ success: false, message: "Server error" });
}

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res
      .status(401)
      .json({ success: false, message: "Authentication required." });
    return null;
  }
  return userId;
}

export class ExpensesController {
  async createExpense(req: AuthenticatedRequest, res: Response) {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = adminExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const result = await createAdminExpenseService.execute(
        userId,
        parsed.data,
      );
      return res.status(201).json({
        success: true,
        message: "Expense recorded.",
        expense: result.expense,
        ...("shift" in result && result.shift ? { shift: result.shift } : {}),
      });
    } catch (error) {
      return expenseFailure(res, error, "creating expense");
    }
  }

  async listExpenses(req: AuthenticatedRequest, res: Response) {
    if (!requireUserId(req, res)) return;

    const parsed = listExpensesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const result = await listExpensesService.execute(parsed.data);
      return res.json({ success: true, ...result });
    } catch (error) {
      return expenseFailure(res, error, "listing expenses");
    }
  }

  async summary(req: AuthenticatedRequest, res: Response) {
    if (!requireUserId(req, res)) return;

    const parsed = expenseSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const result = await getExpenseSummaryService.execute(parsed.data);
      return res.json({ success: true, ...result });
    } catch (error) {
      return expenseFailure(res, error, "summarizing expenses");
    }
  }

  async voidExpense(req: AuthenticatedRequest, res: Response) {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = expenseActionReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const result = await voidExpenseService.execute(
        userId,
        req.params.id as string,
        parsed.data.reason,
      );
      return res.json({
        success: true,
        message: "Expense voided.",
        expense: result.expense,
      });
    } catch (error) {
      return expenseFailure(res, error, "voiding expense");
    }
  }

  async reverseExpense(req: AuthenticatedRequest, res: Response) {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = expenseActionReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }

    try {
      const result = await reverseExpenseService.execute(
        userId,
        req.params.id as string,
        parsed.data.reason,
      );
      return res.status(201).json({
        success: true,
        message: result.message,
        expense: result.expense,
      });
    } catch (error) {
      return expenseFailure(res, error, "reversing expense");
    }
  }
}

export const expensesController = new ExpensesController();
