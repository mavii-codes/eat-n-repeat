import { z } from "zod";

/**
 * GET /api/sales/figures takes no query parameters. Parsing the (empty) query
 * keeps the controller consistent with the other list/summary endpoints.
 */
export const salesFiguresQuerySchema = z.object({});

export const salesWeeklyEntrySchema = z.object({
  label: z.string(),
  amount: z.number(),
});

export const salesMonthlyEntrySchema = z.object({
  label: z.string(),
  amount: z.number(),
});

export const salesFiguresSnapshotSchema = z.object({
  today: z.object({
    revenue: z.number(),
    orders: z.number().int(),
    completed: z.number().int(),
    pending: z.number().int(),
    // Promo bookkeeping for the same revenue windows.
    totalDiscounts: z.number(),
    grossBeforeDiscounts: z.number(),
  }),
  yesterday_revenue: z.number(),
  change_pct: z.number().nullable(),
  weekly: z.array(salesWeeklyEntrySchema),
  weekly_total: z.number(),
  monthly: z.array(salesMonthlyEntrySchema),
  monthly_total: z.number(),
  yearly_total: z.number(),
  monthly_total_discounts: z.number(),
  monthly_gross_sales_before_discounts: z.number(),
  yearly_total_discounts: z.number(),
  yearly_gross_sales_before_discounts: z.number(),
  // Today's discount totals are ALSO surfaced at the bundle level (the same
  // two numbers) so dashboards can read them without reaching into `today`.
  total_discounts: z.number(),
  gross_sales_before_discounts: z.number(),
  generated_at: z.string(),
});

export type SalesFiguresQuery = z.infer<typeof salesFiguresQuerySchema>;
export type SalesWeeklyEntry = z.infer<typeof salesWeeklyEntrySchema>;
export type SalesMonthlyEntry = z.infer<typeof salesMonthlyEntrySchema>;
export type SalesFiguresSnapshot = z.infer<typeof salesFiguresSnapshotSchema>;
