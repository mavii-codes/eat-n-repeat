import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { expenseRepository } from "@/repositories/expense.repository";
import type {
  AdminExpenseInput,
  DrawerExpenseInput,
} from "@/schema/expenses/expenses.schema";
import { currentExpenseDate } from "@/schema/expenses/expenses.schema";
import { createDrawerExpenseService } from "@/services/expenses/create-drawer-expense";
import { expenseError, mapExpense } from "@/services/expenses/helpers";
import { emitAdminEvent } from "@/lib/sse";

/**
 * Admin expense entry.
 *
 * - paymentSource "other": bookkeeping-only row (no shift, no drawer write).
 * - paymentSource "cash_drawer": delegated to the shared drawer transaction,
 *   which atomically decrements the open shift's expected cash.
 */
export class CreateAdminExpenseService {
  async execute(adminId: string, input: AdminExpenseInput) {
    const caller = await expenseRepository.findUserById(adminId);
    if (!caller) throw expenseError("Authenticated user not found.", 401);
    if (caller.role !== "admin") {
      throw expenseError("Admin access required.", 403);
    }

    if (input.paymentSource === "other") {
      const created = await expenseRepository.create({
        id: `exp-${crypto.randomUUID()}`,
        source: "admin",
        paymentSource: "other",
        shiftId: null,
        category: input.category,
        amount: new Prisma.Decimal(input.amount),
        reason: input.reason,
        note: input.note ?? null,
        payee: input.payee ?? null,
        status: "active",
        reversalOfId: null,
        expenseDate: input.date ?? currentExpenseDate(),
        createdById: caller.id,
        createdByName: caller.name,
        createdByRole: caller.role,
      });

      try {
        emitAdminEvent({ type: "EXPENSE_UPDATED", at: new Date().toISOString() });
      } catch {
        /* event must never break the write */
      }

      return { expense: mapExpense(created) };
    }

    // cash_drawer: prefer the admin's own open shift, otherwise any open one.
    const shift =
      (await expenseRepository.findOpenShiftByStaffId(adminId)) ??
      (await expenseRepository.findAnyOpenShift());

    if (!shift) {
      throw expenseError(
        "No open shift found — cash drawer expenses require an open shift.",
        400,
      );
    }

    const drawerInput: DrawerExpenseInput = {
      amount: input.amount,
      category: input.category as DrawerExpenseInput["category"],
      reason: input.reason,
      note: input.note,
    };

    const result = await createDrawerExpenseService.execute(
      adminId,
      shift.id,
      drawerInput,
      {
        source: "admin",
        payee: input.payee ?? null,
        expenseDate: input.date,
      },
    );

    try {
      emitAdminEvent({ type: "EXPENSE_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return result;
  }
}

export const createAdminExpenseService = new CreateAdminExpenseService();
