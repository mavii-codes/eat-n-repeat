export class ExpenseServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function expenseError(message: string, statusCode: number) {
  return new ExpenseServiceError(message, statusCode);
}

type ExpenseRow = {
  id: string;
  source: string;
  paymentSource: string;
  shiftId: string | null;
  category: string;
  amount: any;
  reason: string;
  note: string | null;
  payee: string | null;
  status: string;
  voidReason: string | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidedAt: Date | null;
  reversalOfId: string | null;
  expenseDate: Date;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  createdAt: Date;
};

export function mapExpense(row: ExpenseRow) {
  return {
    id: row.id,
    source: row.source,
    payment_source: row.paymentSource,
    shift_id: row.shiftId,
    category: row.category,
    amount: Number(row.amount),
    reason: row.reason,
    note: row.note,
    payee: row.payee,
    status: row.status,
    void_reason: row.voidReason,
    voided_by_id: row.voidedById,
    voided_by_name: row.voidedByName,
    voided_at: row.voidedAt,
    reversal_of_id: row.reversalOfId,
    expense_date: row.expenseDate,
    created_by_id: row.createdById,
    created_by_name: row.createdByName,
    created_by_role: row.createdByRole,
    created_at: row.createdAt,
    kind: row.reversalOfId ? ("reversal" as const) : ("expense" as const),
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
