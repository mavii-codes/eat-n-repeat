import crypto from "crypto";
import { expenseRepository } from "@/repositories/expense.repository";
import { currentExpenseDate } from "@/schema/expenses/expenses.schema";
import { expenseError, mapExpense } from "@/services/expenses/helpers";
import { emitAdminEvent } from "@/lib/sse";

/**
 * Admin-only reversal of a drawer paid-out. The original row stays in the
 * ledger; a negative-effect reversal row is appended. If the original shift is
 * still open, the drawer's expected cash is restored. Closed shifts are left
 * untouched (closed figures are immutable).
 */
export class ReverseExpenseService {
  async execute(adminId: string, expenseId: string, reason: string) {
    const caller = await expenseRepository.findUserById(adminId);
    if (!caller) throw expenseError("Authenticated user not found.", 401);
    if (caller.role !== "admin") {
      throw expenseError("Admin access required.", 403);
    }

    const result = await expenseRepository.transaction(async (tx) => {
      const original = await expenseRepository.findById(expenseId, tx);
      if (!original) throw expenseError("Expense not found.", 404);

      if (original.source !== "drawer") {
        throw expenseError("Only drawer paid-outs can be reversed.", 409);
      }

      const existing = await expenseRepository.findReversalByOriginalId(
        original.id,
        tx,
      );
      if (existing) throw expenseError("Already reversed.", 409);

      if (original.reversalOfId) {
        throw expenseError("Reversal entries cannot be reversed.", 409);
      }

      let restored = false;
      let shiftClosed = false;

      if (original.shiftId) {
        const shift = await tx.cashShift.findUnique({
          where: { id: original.shiftId },
        });

        if (shift) {
          if (shift.status === "open") {
            if (original.paymentSource === "cash_drawer") {
              await tx.cashShift.update({
                where: { id: shift.id },
                data: { expectedCash: { increment: original.amount } },
              });
              restored = true;
            }
          } else {
            shiftClosed = true;
          }
        }
      }

      const reversal = await expenseRepository.create(
        {
          id: `exp-${crypto.randomUUID()}`,
          source: "drawer",
          paymentSource: "cash_drawer",
          shiftId: original.shiftId,
          category: original.category,
          amount: original.amount,
          reason,
          note: null,
          payee: null,
          status: "active",
          reversalOfId: original.id,
          expenseDate: currentExpenseDate(),
          createdById: caller.id,
          createdByName: caller.name,
          createdByRole: caller.role,
        },
        tx,
      );

      let message = restored
        ? "Reversal recorded — drawer expected cash restored."
        : "Reversal recorded in the ledger.";
      if (shiftClosed) {
        message += " (shift already closed — closed figures left unchanged.)";
      }

      return { expense: mapExpense(reversal), message };
    });

    try {
      emitAdminEvent({ type: "EXPENSE_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return result;
  }
}

export const reverseExpenseService = new ReverseExpenseService();
