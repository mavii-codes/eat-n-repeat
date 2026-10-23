import { expenseRepository } from "@/repositories/expense.repository";
import type { ExpenseFilters } from "@/repositories/expense.repository";
import type { ExpensesQuery } from "@/schema/expenses/expenses.schema";
import { mapExpense } from "@/services/expenses/helpers";

export class ListExpensesService {
  async execute(query: ExpensesQuery) {
    const baseFilters: ExpenseFilters = {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      category: query.category,
      // The wire field is `origin`; the repository stores it as `source`.
      source: query.origin,
      paymentSource: query.paymentSource,
      createdById: query.createdById,
    };

    // No status filter unless the caller asked for one, so voided rows are
    // visible by default (the summary always nets active rows only).
    const filters: ExpenseFilters = {
      ...baseFilters,
      status: query.status,
    };

    const { rows, total } = await expenseRepository.list(
      filters,
      query.page,
      query.limit,
    );
    const summary = await expenseRepository.summarize(baseFilters);

    return {
      expenses: rows.map(mapExpense),
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.limit)),
      summary: { total: summary.total, count: summary.count },
    };
  }
}

export const listExpensesService = new ListExpensesService();
