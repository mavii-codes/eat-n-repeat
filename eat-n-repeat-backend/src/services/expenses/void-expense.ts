import { expenseRepository } from "@/repositories/expense.repository";
import { expenseError, mapExpense } from "@/services/expenses/helpers";
import { emitAdminEvent } from "@/lib/sse";

/**
 * Admin-only void for bookkeeping-only expenses (source "admin", paid from
 * "other"). Voided rows stay in the ledger but are excluded from active nets.
 * The drawer (`expectedCash`) is never touched here — these expenses never
 * affected it.
 */
export class VoidExpenseService {
  async execute(adminId: string, expenseId: string, reason: string) {
    const caller = await expenseRepository.findUserById(adminId);
    if (!caller) throw expenseError("Authenticated user not found.", 401);
    if (caller.role !== "admin") {
      throw expenseError("Admin access required.", 403);
    }

    const original = await expenseRepository.findById(expenseId);
    if (!original) throw expenseError("Expense not found.", 404);

    if (original.source !== "admin" || original.paymentSource !== "other") {
      throw expenseError(
        "Only other-source admin expenses can be voided.",
        409,
      );
    }
    if (original.status !== "active") {
      throw expenseError("Already voided.", 409);
    }

    const reversal = await expenseRepository.findReversalByOriginalId(original.id);
    if (reversal) {
      throw expenseError("Reversed expenses cannot be voided.", 409);
    }

    const updated = await expenseRepository.voidExpense(original.id, {
      status: "voided",
      voidReason: reason,
      voidedById: caller.id,
      voidedByName: caller.name,
      voidedAt: new Date(),
    });

    try {
      emitAdminEvent({ type: "EXPENSE_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return { expense: mapExpense(updated) };
  }
}

export const voidExpenseService = new VoidExpenseService();
