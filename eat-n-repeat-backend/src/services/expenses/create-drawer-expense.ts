import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { expenseRepository } from "@/repositories/expense.repository";
import type { DrawerExpenseInput } from "@/schema/expenses/expenses.schema";
import { currentExpenseDate } from "@/schema/expenses/expenses.schema";
import { expenseError, mapExpense } from "@/services/expenses/helpers";
import { mapShift } from "@/services/cash/helpers";
import { emitAdminEvent } from "@/lib/sse";

type CreateDrawerOptions = {
  /** "admin" for admin cash-drawer entries, "drawer" for cashier paid-outs. */
  source?: "drawer" | "admin";
  payee?: string | null;
  expenseDate?: Date;
};

export class CreateDrawerExpenseService {
  async execute(
    userId: string,
    shiftId: string,
    input: DrawerExpenseInput,
    options: CreateDrawerOptions = {},
  ) {
    const user = await expenseRepository.findUserById(userId);
    if (!user) throw expenseError("Authenticated user not found.", 401);

    if (!(STAFF_ROLES as readonly string[]).includes(user.role)) {
      throw expenseError("Forbidden for this role.", 403);
    }

    const shift = await expenseRepository.findCashShiftById(shiftId);
    if (!shift) throw expenseError("Shift not found.", 404);
    if (shift.status !== "open") {
      throw expenseError("Cannot add an expense to a closed shift.", 400);
    }
    if (user.role === "staff" && shift.staffId !== userId) {
      throw expenseError("You can only add expenses to your own shift.", 403);
    }

    const amount = new Prisma.Decimal(input.amount);
    const expenseDate = options.expenseDate ?? currentExpenseDate();
    const source = options.source ?? "drawer";

    const result = await expenseRepository.transaction(async (tx) => {
      // Re-read inside the transaction: the shift may have been closed while
      // the caller was composing the expense.
      const current = await tx.cashShift.findUnique({ where: { id: shiftId } });
      if (!current) throw expenseError("Shift not found.", 404);
      if (current.status !== "open") {
        throw expenseError("Cannot add an expense to a closed shift.", 400);
      }

      // Precise rejection for the common case: the amount simply exceeds the
      // drawer. (The atomic guard below remains as the race backstop.)
      if (amount.greaterThan(current.expectedCash)) {
        throw expenseError(
          `Expense exceeds the cash expected in the drawer (₱${current.expectedCash.toFixed(2)}).`,
          400,
        );
      }

      const created = await expenseRepository.create(
        {
          id: `exp-${crypto.randomUUID()}`,
          source,
          paymentSource: "cash_drawer",
          shiftId,
          category: input.category,
          amount,
          reason: input.reason,
          note: input.note ?? null,
          payee: options.payee ?? null,
          status: "active",
          reversalOfId: null,
          expenseDate,
          createdById: user.id,
          createdByName: user.name,
          createdByRole: user.role,
        },
        tx,
      );

      // Atomic guard: a concurrent sale/expense must not push the drawer
      // negative. A zero-row result rolls the whole transaction back.
      const update = await tx.cashShift.updateMany({
        where: {
          id: shiftId,
          status: "open",
          expectedCash: { gte: amount },
        },
        data: { expectedCash: { decrement: amount } },
      });
      if (update.count !== 1) {
        throw expenseError("Drawer balance changed. Try again.", 409);
      }

      const freshShift = await tx.cashShift.findUniqueOrThrow({
        where: { id: shiftId },
      });

      return {
        expense: mapExpense(created),
        shift: mapShift(freshShift),
      };
    });

    try {
      emitAdminEvent({ type: "EXPENSE_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return result;
  }
}

export const createDrawerExpenseService = new CreateDrawerExpenseService();
