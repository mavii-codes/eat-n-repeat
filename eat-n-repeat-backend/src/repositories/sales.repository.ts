import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MANILA_OFFSET_MS, manilaDayRange } from "@/lib/pos-receipt";

const DAY_MS = 24 * 60 * 60 * 1000;

// Statuses that never count as revenue and never appear in dashboard totals.
const REVENUE_EXCLUDED_STATUSES = ["cancelled", "voided"];
// Statuses the dashboard labels "completed" (same literals used by admin
// order updates, delivery completion, and the Xendit/webhook confirmation).
const COMPLETED_STATUSES = ["completed", "confirmed"];
// Payment truth for online orders (admin mark-paid + Xendit webhook).
const PAID_PAYMENT_STATUS = "PAID";
// POS sales recorded against the drawer with NO payments row (cash/GCash).
const PAID_CASH_TRANSACTION_TYPES = ["sale", "gcash_sale"];

export type SalesWeeklyRawEntry = { date: string; amount: number };
export type SalesMonthlyRawEntry = { month: number; amount: number };

export type SalesFiguresRaw = {
  today: {
    revenue: number;
    orders: number;
    completed: number;
    pending: number;
    // Promo bookkeeping for the same windows. Revenue semantics untouched:
    // `revenue` stays the after-discount money that was collected.
    totalDiscounts: number;
    grossBeforeDiscounts: number;
  };
  yesterdayRevenue: number;
  weekly: SalesWeeklyRawEntry[];
  monthly: SalesMonthlyRawEntry[];
  yearlyTotal: number;
  currentMonthTotal: number;
  monthlyTotalDiscounts: number;
  monthlyGrossBeforeDiscounts: number;
  yearlyTotalDiscounts: number;
  yearlyGrossBeforeDiscounts: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** PH calendar day key (YYYY-MM-DD) for a UTC instant (fixed UTC+8). */
export function phDayKey(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** UTC instant at Asia/Manila midnight for a PH calendar day key. */
function phDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000+08:00`);
}

/** UTC instant at Asia/Manila midnight on the first of a PH month. */
function phMonthStart(year: number, month: number): Date {
  return new Date(`${year}-${pad2(month)}-01T00:00:00.000+08:00`);
}

/**
 * Order-side revenue rule (single source of truth):
 *   (a) the order is not cancelled/voided and has no cancellation timestamp;
 *   (b) it is not archived.
 * The payment half of the rule (PAID payment OR sale/gcash_sale cash tx) is
 * joined in JS in getFigures because cash_transactions has no Prisma relation
 * to orders. Unpaid/pending orders therefore never match.
 */
export function buildRevenueOrderWhere(range: {
  start: Date;
  end: Date;
}): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: range.start, lt: range.end },
    status: { notIn: [...REVENUE_EXCLUDED_STATUSES] },
    cancelledAt: null,
    archived: false,
  };
}

export class SalesRepository {
  /**
   * Raw figures for the current Asia/Manila day/week/month/year.
   *
   * Three table round trips total: one candidate-order query spanning every
   * window, plus paid-payment and POS-sale lookups keyed by those candidate
   * ids. Everything else (PH day buckets, Mon..Sun / Jan..Dec arrays) is
   * derived in memory so a single snapshot cannot drift between windows.
   */
  async getFigures(now: Date = new Date()): Promise<SalesFiguresRaw> {
    const today = manilaDayRange(now);
    const yesterdayStart = new Date(today.start.getTime() - DAY_MS);
    const yesterdayKey = phDayKey(yesterdayStart);

    // Current PH week: Monday..Sunday.
    const todayWall = new Date(`${today.date}T00:00:00.000Z`);
    const mondayOffset = (todayWall.getUTCDay() + 6) % 7;
    const weekStart = phDayStart(
      new Date(todayWall.getTime() - mondayOffset * DAY_MS)
        .toISOString()
        .slice(0, 10),
    );
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

    // Current PH month/year.
    const [year, month] = today.date.split("-").map(Number);
    const yearStart = phMonthStart(year, 1);
    const nextYearStart = phMonthStart(year + 1, 1);

    // Broad enough to cover every window (a week can straddle New Year).
    const rangeStart = new Date(
      Math.min(
        weekStart.getTime(),
        yearStart.getTime(),
        yesterdayStart.getTime(),
      ),
    );
    const rangeEnd = new Date(
      Math.max(
        weekEnd.getTime(),
        nextYearStart.getTime(),
        today.end.getTime(),
      ),
    );

    const candidateOrders = await prisma.order.findMany({
      where: buildRevenueOrderWhere({ start: rangeStart, end: rangeEnd }),
      select: { id: true, total: true, status: true, createdAt: true, discountAmount: true },
    });

    const orderIds = candidateOrders.map((order) => order.id);
    let paidPayments: Array<{ orderId: string }> = [];
    let saleTransactions: Array<{ orderId: string | null }> = [];

    if (orderIds.length > 0) {
      // Start both lookups before awaiting so they still run in parallel.
      const paidPaymentsQuery = prisma.payment.findMany({
        where: {
          orderId: { in: orderIds },
          status: PAID_PAYMENT_STATUS,
        },
        select: { orderId: true },
      });
      const saleTransactionsQuery = prisma.cashTransaction.findMany({
        where: {
          orderId: { in: orderIds },
          type: { in: [...PAID_CASH_TRANSACTION_TYPES] },
        },
        select: { orderId: true },
      });
      paidPayments = await paidPaymentsQuery;
      saleTransactions = await saleTransactionsQuery;
    }

    // Paid id set: an order may have both a PAID payment and a POS sale tx.
    const paidOrderIds = new Set<string>();
    for (const payment of paidPayments) paidOrderIds.add(payment.orderId);
    for (const tx of saleTransactions) {
      if (tx.orderId) paidOrderIds.add(tx.orderId);
    }

    let todayRevenue = 0;
    let todayOrders = 0;
    let todayCompleted = 0;
    let todayTotalDiscounts = 0;
    let monthlyTotalDiscounts = 0;
    let yearlyTotalDiscounts = 0;
    let yesterdayRevenue = 0;
    const dayRevenue = new Map<string, number>();
    const monthRevenue = new Map<number, number>();
    let yearlyTotal = 0;

    for (const order of candidateOrders) {
      const createdAt = order.createdAt;
      const dayKey = phDayKey(createdAt);
      const amount = Number(order.total) || 0;
      const isRevenue = paidOrderIds.has(order.id);

      if (isRevenue) {
        const orderDiscount = Number(order.discountAmount) || 0;
        dayRevenue.set(dayKey, (dayRevenue.get(dayKey) ?? 0) + amount);

        if (createdAt >= yearStart && createdAt < nextYearStart) {
          const orderMonth = Number(dayKey.slice(5, 7));
          monthRevenue.set(
            orderMonth,
            (monthRevenue.get(orderMonth) ?? 0) + amount,
          );
          yearlyTotal += amount;
          yearlyTotalDiscounts += orderDiscount;
          if (orderMonth === month) {
            monthlyTotalDiscounts += orderDiscount;
          }
        }
      }

      if (createdAt >= today.start && createdAt < today.end) {
        todayOrders += 1;
        if (isRevenue) {
          todayRevenue += amount;
          todayTotalDiscounts += Number(order.discountAmount) || 0;
        }
        if ((COMPLETED_STATUSES as readonly string[]).includes(order.status)) {
          todayCompleted += 1;
        }
      }

      if (dayKey === yesterdayKey && isRevenue) {
        yesterdayRevenue += amount;
      }
    }

    const weekly: SalesWeeklyRawEntry[] = [];
    for (let index = 0; index < 7; index += 1) {
      const dayKey = phDayKey(new Date(weekStart.getTime() + index * DAY_MS));
      weekly.push({
        date: dayKey,
        amount: roundMoney(dayRevenue.get(dayKey) ?? 0),
      });
    }

    const monthly: SalesMonthlyRawEntry[] = [];
    for (let index = 1; index <= 12; index += 1) {
      monthly.push({
        month: index,
        amount: roundMoney(monthRevenue.get(index) ?? 0),
      });
    }

    return {
      today: {
        revenue: roundMoney(todayRevenue),
        orders: todayOrders,
        completed: todayCompleted,
        // Pending is the complement of completed within today's open orders:
        // every non-cancelled/voided/archived row that is not yet
        // completed/confirmed (unpaid online orders plus in-flight statuses).
        // completed + pending therefore equals `orders`.
        pending: Math.max(0, todayOrders - todayCompleted),
        // Discounts collected today + the matching before-discount gross.
        totalDiscounts: roundMoney(todayTotalDiscounts),
        grossBeforeDiscounts: roundMoney(todayRevenue + todayTotalDiscounts),
      },
      yesterdayRevenue: roundMoney(yesterdayRevenue),
      weekly,
      monthly,
      yearlyTotal: roundMoney(yearlyTotal),
      currentMonthTotal: monthly[month - 1]?.amount ?? 0,
      monthlyTotalDiscounts: roundMoney(monthlyTotalDiscounts),
      monthlyGrossBeforeDiscounts: roundMoney(
        (monthly[month - 1]?.amount ?? 0) + monthlyTotalDiscounts,
      ),
      yearlyTotalDiscounts: roundMoney(yearlyTotalDiscounts),
      yearlyGrossBeforeDiscounts: roundMoney(yearlyTotal + yearlyTotalDiscounts),
    };
  }
}

export const salesRepository = new SalesRepository();
