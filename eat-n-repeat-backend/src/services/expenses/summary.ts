import { expenseRepository } from "@/repositories/expense.repository";
import type { ExpenseFilters } from "@/repositories/expense.repository";
import type { ExpenseSummaryQuery } from "@/schema/expenses/expenses.schema";

export class GetExpenseSummaryService {
  async execute(query: ExpenseSummaryQuery) {
    const filters: ExpenseFilters = {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };

    const [expenseSummary, stockPurchases] = await Promise.all([
      expenseRepository.summarize(filters),
      expenseRepository.summarizeStockPurchases(filters),
    ]);

    // Stock purchases stay outside `total`: they are shown as a separate line
    // and must never double-count against the expense ledger.
    return {
      total: expenseSummary.total,
      count: expenseSummary.count,
      stockPurchases,
    };
  }
}

export const getExpenseSummaryService = new GetExpenseSummaryService();
