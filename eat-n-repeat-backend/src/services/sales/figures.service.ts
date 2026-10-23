import { salesRepository } from "@/repositories/sales.repository";
import type {
  SalesMonthlyEntry,
  SalesWeeklyEntry,
} from "@/schema/sales/figures.schema";

const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Single source of truth for dashboard revenue figures. The repository
 * returns raw PH-window aggregates; this service turns them into the
 * snake_case API bundle (labels, totals, change percentage, timestamp).
 */
export class SalesFiguresService {
  async execute() {
    const raw = await salesRepository.getFigures();

    const weekly: SalesWeeklyEntry[] = raw.weekly.map((entry, index) => ({
      label: WEEKDAY_LABELS[index] ?? entry.date,
      amount: entry.amount,
    }));
    const monthly: SalesMonthlyEntry[] = raw.monthly.map((entry) => ({
      label: MONTH_LABELS[entry.month - 1],
      amount: entry.amount,
    }));

    const weeklyTotal = roundMoney(
      weekly.reduce((sum, entry) => sum + entry.amount, 0),
    );
    // `monthly_total` is the CURRENT PH month (the reports page renders it as
    // "This month"), while `yearly_total` is the sum of all 12 months.
    const monthlyTotal = raw.currentMonthTotal;

    // No sales yesterday => no percentage (the UI shows "no sales yesterday").
    const changePct =
      raw.yesterdayRevenue > 0
        ? Math.round(
            ((raw.today.revenue - raw.yesterdayRevenue) /
              raw.yesterdayRevenue) *
              1000,
          ) / 10
        : null;

    return {
      today: raw.today,
      yesterday_revenue: raw.yesterdayRevenue,
      change_pct: changePct,
      weekly,
      weekly_total: weeklyTotal,
      monthly,
      monthly_total: monthlyTotal,
      yearly_total: raw.yearlyTotal,
      // Promo bookkeeping, same windows as above (revenue semantics untouched).
      total_discounts: raw.today.totalDiscounts,
      gross_sales_before_discounts: raw.today.grossBeforeDiscounts,
      monthly_total_discounts: raw.monthlyTotalDiscounts,
      monthly_gross_sales_before_discounts: raw.monthlyGrossBeforeDiscounts,
      yearly_total_discounts: raw.yearlyTotalDiscounts,
      yearly_gross_sales_before_discounts: raw.yearlyGrossBeforeDiscounts,
      generated_at: new Date().toISOString(),
    };
  }
}

export const salesFiguresService = new SalesFiguresService();
