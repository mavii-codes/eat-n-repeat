import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ExpenseFilters = {
  from?: Date;
  to?: Date;
  category?: string;
  source?: string;
  paymentSource?: string;
  createdById?: string;
  status?: string;
};

export type CreateExpenseData = {
  id: string;
  source: string;
  paymentSource: string;
  shiftId?: string | null;
  category: string;
  amount: Prisma.Decimal;
  reason: string;
  note?: string | null;
  payee?: string | null;
  status?: string;
  reversalOfId?: string | null;
  expenseDate: Date;
  createdById: string;
  createdByName: string;
  createdByRole: string;
};

export type VoidExpenseData = {
  status: string;
  voidReason: string;
  voidedById: string;
  voidedByName: string;
  voidedAt: Date;
};

export type ShiftExpenseNet = { net: number; count: number };

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function buildWhere(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  if (filters.from || filters.to) {
    where.expenseDate = {};
    if (filters.from) where.expenseDate.gte = filters.from;
    if (filters.to) where.expenseDate.lte = filters.to;
  }
  if (filters.category) where.category = filters.category;
  if (filters.source) where.source = filters.source;
  if (filters.paymentSource) where.paymentSource = filters.paymentSource;
  if (filters.createdById) where.createdById = filters.createdById;
  if (filters.status) where.status = filters.status;

  return where;
}

export class ExpenseRepository {
  async create(data: CreateExpenseData, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.expense.create({
      data: {
        ...data,
        shiftId: data.shiftId ?? null,
        note: data.note ?? null,
        payee: data.payee ?? null,
        status: data.status ?? "active",
        reversalOfId: data.reversalOfId ?? null,
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.expense.findUnique({ where: { id } });
  }

  async findReversalByOriginalId(
    originalId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? prisma;
    return db.expense.findFirst({
      where: { reversalOfId: originalId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByShiftId(shiftId: string) {
    return prisma.expense.findMany({
      where: { shiftId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async list(filters: ExpenseFilters, page: number, limit: number) {
    const where = buildWhere(filters);
    const [rows, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);
    return { rows, total };
  }

  /** Active ledger net: originals add, reversal rows subtract. */
  async summarize(filters: ExpenseFilters) {
    const rows = await prisma.expense.findMany({
      where: buildWhere({ ...filters, status: "active" }),
      select: { amount: true, reversalOfId: true },
    });

    let total = 0;
    for (const row of rows) {
      const amount = Number(row.amount) || 0;
      total += row.reversalOfId ? -amount : amount;
    }

    return { total: roundMoney(total), count: rows.length };
  }

  /**
   * Stock purchases (STOCK_IN movements) for the same window as `summarize`.
   * Reported separately so the expense ledger total never double-counts
   * inventory bought through Stock In. Movement date follows
   * `receivedAt ?? createdAt`.
   */
  async summarizeStockPurchases(filters: ExpenseFilters) {
    const where: Prisma.StockMovementWhereInput = { type: "STOCK_IN" };

    if (filters.from || filters.to) {
      const range = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
      where.OR = [
        { receivedAt: range },
        { receivedAt: null, createdAt: range },
      ];
    }

    const rows = await prisma.stockMovement.findMany({
      where,
      select: { totalCost: true },
    });

    let total = 0;
    for (const row of rows) {
      total += Number(row.totalCost) || 0;
    }

    return { total: roundMoney(total), count: rows.length };
  }

  /**
   * Batched per-shift expense net for the shift history list. `count` includes
   * every ledger row for the shift; net includes ACTIVE rows only. Reversal
   * rows subtract so a drawer expense plus its reversal nets to zero.
   */
  async groupNetsByShiftIds(
    shiftIds: string[],
  ): Promise<Map<string, ShiftExpenseNet>> {
    const result = new Map<string, ShiftExpenseNet>();
    for (const id of shiftIds) result.set(id, { net: 0, count: 0 });
    if (shiftIds.length === 0) return result;

    const rows = await prisma.expense.findMany({
      where: { shiftId: { in: shiftIds } },
      select: {
        shiftId: true,
        amount: true,
        status: true,
        reversalOfId: true,
      },
    });

    for (const row of rows) {
      if (!row.shiftId) continue;
      const entry = result.get(row.shiftId) ?? { net: 0, count: 0 };
      entry.count += 1;
      if (row.status === "active") {
        const amount = Number(row.amount) || 0;
        entry.net += row.reversalOfId ? -amount : amount;
      }
      result.set(row.shiftId, entry);
    }

    for (const entry of result.values()) entry.net = roundMoney(entry.net);
    return result;
  }

  async voidExpense(
    id: string,
    data: VoidExpenseData,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? prisma;
    return db.expense.update({ where: { id }, data });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
  }

  async findCashShiftById(shiftId: string) {
    return prisma.cashShift.findUnique({ where: { id: shiftId } });
  }

  async findOpenShiftByStaffId(staffId: string) {
    return prisma.cashShift.findFirst({
      where: { staffId, status: "open" },
      orderBy: { startTime: "desc" },
    });
  }

  async findAnyOpenShift() {
    return prisma.cashShift.findFirst({
      where: { status: "open" },
      orderBy: { startTime: "desc" },
    });
  }

  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const expenseRepository = new ExpenseRepository();
