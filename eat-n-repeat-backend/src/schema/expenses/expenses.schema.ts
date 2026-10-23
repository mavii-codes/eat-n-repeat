import { z } from "zod";
import { phDateBoundSchema } from "@/schema/stock/movements.schema";

/** Categories a cashier can pick at the drawer. */
export const DRAWER_EXPENSE_CATEGORIES = [
  "Supplies",
  "Ice",
  "Delivery fee",
  "Utilities",
  "Other",
] as const;

/** Admin-only categories added to the drawer list. */
export const ADMIN_EXPENSE_CATEGORIES = [
  ...DRAWER_EXPENSE_CATEGORIES,
  "Rent",
  "Electricity",
  "Water",
  "Salaries",
  "Supplier",
  "Maintenance",
] as const;

export const EXPENSE_PAYMENT_SOURCES = ["cash_drawer", "other"] as const;
export const EXPENSE_ORIGINS = ["drawer", "admin"] as const;
export const EXPENSE_STATUSES = ["active", "voided"] as const;

export type ExpensePaymentSource = (typeof EXPENSE_PAYMENT_SOURCES)[number];
export type ExpenseOrigin = (typeof EXPENSE_ORIGINS)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

const PH_OFFSET = "+08:00";
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const isRealCalendarDate = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
};

/** Midnight of the Asia/Manila calendar day containing `date`. */
export function startOfPhDay(date: Date): Date {
  const shifted = new Date(date.getTime() + PH_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - PH_OFFSET_MS,
  );
}

/** Today's date at midnight Asia/Manila (fixed UTC+8, no DST). */
export function currentExpenseDate(): Date {
  return startOfPhDay(new Date());
}

/**
 * Expense date input: bare YYYY-MM-DD or an ISO datetime. Both normalize to
 * the Philippine calendar day at midnight, and future days are rejected.
 */
export const expenseDateSchema = z
  .string({ required_error: "Expense date is required." })
  .trim()
  .transform((value, ctx) => {
    let normalized: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (!isRealCalendarDate(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expense date is not a valid calendar date.",
        });
        return z.NEVER;
      }
      normalized = new Date(`${value}T00:00:00${PH_OFFSET}`);
    } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      if (!z.string().datetime({ offset: true }).safeParse(value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expense date must be a valid ISO datetime.",
        });
        return z.NEVER;
      }
      normalized = startOfPhDay(new Date(value));
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expense date must be YYYY-MM-DD or an ISO datetime.",
      });
      return z.NEVER;
    }

    if (normalized.getTime() > currentExpenseDate().getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expense date cannot be in the future.",
      });
      return z.NEVER;
    }

    return normalized;
  });

const amountSchema = z.coerce
  .number({ invalid_type_error: "Amount is required." })
  .finite("Amount must be a valid number.")
  .positive("Amount must be greater than zero.")
  .max(999999.99, "Amount is too large.")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    "Amount can have at most 2 decimal places.",
  );

const reasonSchema = z
  .string({ required_error: "Reason is required." })
  .trim()
  .min(3, "Reason must be at least 3 characters.")
  .max(500, "Reason must be 500 characters or fewer.");

const optionalText = (max: number, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional(),
  );

const categorySchema = z.enum(DRAWER_EXPENSE_CATEGORIES, {
  errorMap: () => ({ message: "Invalid expense category." }),
});

const adminCategorySchema = z.enum(ADMIN_EXPENSE_CATEGORIES, {
  errorMap: () => ({ message: "Invalid expense category." }),
});

/** Cashier paid-out from their own open drawer. */
export const drawerExpenseSchema = z.object({
  amount: amountSchema,
  category: categorySchema,
  reason: reasonSchema,
  note: optionalText(1000, "Note"),
});

/** Admin expense entry. `other` is bookkeeping-only (no shift/drawer write). */
export const adminExpenseSchema = z.object({
  date: expenseDateSchema.optional(),
  amount: amountSchema,
  category: adminCategorySchema,
  payee: optionalText(120, "Payee"),
  paymentSource: z.enum(EXPENSE_PAYMENT_SOURCES, {
    errorMap: () => ({ message: "Invalid payment source." }),
  }),
  reason: reasonSchema,
  note: optionalText(1000, "Note"),
});

export const expenseActionReasonSchema = z.object({
  reason: z
    .string({ required_error: "Reason is required." })
    .trim()
    .min(3, "Reason must be at least 3 characters.")
    .max(500, "Reason must be 500 characters or fewer."),
});

export const listExpensesQuerySchema = z.object({
  from: phDateBoundSchema("from").optional(),
  to: phDateBoundSchema("to").optional(),
  category: z.preprocess(
    emptyToUndefined,
    adminCategorySchema.optional(),
  ),
  paymentSource: z.preprocess(
    emptyToUndefined,
    z
      .enum(EXPENSE_PAYMENT_SOURCES, {
        errorMap: () => ({ message: "Invalid payment source." }),
      })
      .optional(),
  ),
  origin: z.preprocess(
    emptyToUndefined,
    z
      .enum(EXPENSE_ORIGINS, {
        errorMap: () => ({ message: "Invalid origin." }),
      })
      .optional(),
  ),
  createdById: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(64).optional(),
  ),
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(EXPENSE_STATUSES, {
        errorMap: () => ({ message: "Invalid status." }),
      })
      .optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const expenseSummaryQuerySchema = z.object({
  from: phDateBoundSchema("from").optional(),
  to: phDateBoundSchema("to").optional(),
});

export type DrawerExpenseInput = z.infer<typeof drawerExpenseSchema>;
export type AdminExpenseInput = z.infer<typeof adminExpenseSchema>;
export type ExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ExpenseSummaryQuery = z.infer<typeof expenseSummaryQuerySchema>;
