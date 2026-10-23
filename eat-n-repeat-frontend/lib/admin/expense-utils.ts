import type { ExpenseItem } from "@/lib/admin/types";

/**
 * Shared helpers for the Expenses surfaces (staff drawer modal, admin
 * log page, shift details). Follows the lib/ conventions: pure functions,
 * typed, no React. Chip styling mirrors the Cash Management badges.
 */

/** Full admin log category list (drawer five first, then admin-only ones). */
export const EXPENSE_CATEGORIES = [
  "Supplies",
  "Ice",
  "Delivery fee",
  "Utilities",
  "Other",
  "Rent",
  "Electricity",
  "Water",
  "Salaries",
  "Supplier",
  "Maintenance",
] as const;

/** Drawer POS paid-out categories (the five the shift endpoint accepts). */
export const EXPENSE_DRAWER_CATEGORIES = [
  "Supplies",
  "Ice",
  "Delivery fee",
  "Utilities",
  "Other",
] as const;

/** Wire-row casing: the server's mapExpense emits snake_case while the
 *  surfaces read camelCase (ExpenseItem). Aliases map wire → camel. */
const EXPENSE_WIRE_ALIASES: Record<string, keyof ExpenseItem> = {
  payment_source: "paymentSource",
  shift_id: "shiftId",
  void_reason: "voidReason",
  voided_by_name: "voidedByName",
  voided_at: "voidedAt",
  reversal_of_id: "reversalOfId",
  expense_date: "expenseDate",
  created_by_id: "createdById",
  created_by_name: "createdByName",
  created_by_role: "createdByRole",
  created_at: "createdAt",
};

/** Normalizes one expense row from the wire; keys that already arrive in
 *  camelCase pass through untouched (tolerant both ways). */
export function normalizeExpense(
  raw: Record<string, unknown> | null | undefined,
): ExpenseItem {
  const row: Record<string, unknown> = { ...(raw ?? {}) };
  for (const [wire, camel] of Object.entries(EXPENSE_WIRE_ALIASES)) {
    if (wire in row && !(camel in row)) row[camel] = row[wire];
  }
  return row as ExpenseItem;
}

/** Normalizes a row list from any expense payload (log list, shift-details,
 *  /shift/current, write responses). */
export function normalizeExpenses(expenses: unknown): ExpenseItem[] {
  return Array.isArray(expenses)
    ? expenses
        .filter(Boolean)
        .map((row) => normalizeExpense(row as Record<string, unknown>))
    : [];
}

const CHIP_CLASS =
  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap";

type ExpenseRowish = Pick<ExpenseItem, "amount" | "status" | "reversalOfId" | "kind">;

/** True when the row IS a reversal (it adds money back to the drawer). */
export function isExpenseReversal(
  row: Pick<ExpenseItem, "reversalOfId" | "kind" | "status">,
): boolean {
  if (row.kind === "reversal") return true;
  if (row.kind === "expense") return false;
  return row.reversalOfId != null;
}

/** Net drawer amount for a set of shift expense rows: active expenses out,
 *  reversals back. Voided rows don't move the drawer. */
export function expenseRowsNet(rows: ExpenseRowish[]): number {
  let net = 0;
  for (const row of rows) {
    if (row.status === "voided") continue;
    const amt = Number(row.amount) || 0;
    if (isExpenseReversal(row)) net -= amt;
    else net += amt;
  }
  return Math.round(net * 100) / 100;
}

/** Net expenses for a shift payload — a Number on list rows, a row array
 *  on /shift/current and shift-details payloads. */
export function shiftExpensesNet(
  shift: { expenses?: number | string | ExpenseItem[] | null } | null | undefined,
): number {
  if (!shift) return 0;
  if (Array.isArray(shift.expenses)) return expenseRowsNet(shift.expenses);
  return Number(shift.expenses) || 0;
}

/** Source tag: where the money physically left from. */
export function expenseSourceChip(row: Pick<ExpenseItem, "source" | "paymentSource">): {
  label: string;
  className: string;
} {
  if (row.source === "drawer" || row.paymentSource === "cash_drawer") {
    return { label: "Drawer", className: `${CHIP_CLASS} bg-amber-50 text-amber-700 border-amber-200` };
  }
  return { label: "Admin", className: `${CHIP_CLASS} bg-stone-100 text-stone-600 border-stone-200` };
}

/** Status tag for a single expense row. */
export function expenseStatusChip(row: ExpenseItem): {
  label: string;
  className: string;
  title?: string;
} {
  if (isExpenseReversal(row)) {
    return { label: "↺ Reversal", className: `${CHIP_CLASS} bg-emerald-50 text-emerald-700 border-emerald-200` };
  }
  if (row.status === "voided") {
    return {
      label: "Voided",
      className: `${CHIP_CLASS} bg-stone-100 text-stone-500 border-stone-200`,
      title: row.voidReason || undefined,
    };
  }
  return { label: "Active", className: `${CHIP_CLASS} bg-emerald-50 text-emerald-700 border-emerald-200` };
}

/** Neutral category chip shared by the surfaces. */
export function expenseCategoryChip(): { className: string } {
  return { className: `${CHIP_CLASS} bg-stone-100 text-stone-600 border-stone-200` };
}
