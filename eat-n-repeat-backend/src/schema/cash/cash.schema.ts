import { z } from "zod";

export const endShiftSchema = z.object({
  shiftId: z.string().min(1, "shiftId is required"),
  actualCash: z.number().min(0, "Invalid actual cash amount"),
  notes: z.string().trim().max(2000).optional(),
});

export const flagShiftSchema = z.object({
  reason: z.string().trim().min(1, "A flag reason is required.").max(255),
});

export const addFloatSchema = z.object({
  amount: z.number().positive("Invalid amount"),
  reason: z.string().min(1, "Reason is required"),
});

export const editAuditSignoffSchema = z.object({
  status: z.preprocess(
    (val) => (typeof val === "string" ? val.toLowerCase().trim() : val),
    z.enum(["unverified", "verified", "flagged"])
  ),
  reason: z.string().trim().max(255).optional(),
}).refine(
  (data) => {
    if (data.status === "flagged") {
      return Boolean(data.reason && data.reason.trim().length > 0);
    }
    return true;
  },
  {
    message: "A flag reason is required when flagging a shift.",
    path: ["reason"],
  }
);

export type EndShiftInput = z.infer<typeof endShiftSchema>;
export type AddFloatInput = z.infer<typeof addFloatSchema>;
export type FlagShiftInput = z.infer<typeof flagShiftSchema>;
export type EditAuditSignoffInput = z.infer<typeof editAuditSignoffSchema>;


// ---------------------------------------------------------------------------
// Shift History list query (filters + sorting). Whitelisted values only —
// raw input never reaches a query.
// ---------------------------------------------------------------------------

export const shiftSortFields = [
  "date",
  "staff",
  "variance",
  "counted_cash",
  "expected_cash",
  "duration",
] as const;

export const shiftSortDirections = ["asc", "desc"] as const;

// Only statuses that already exist in the cash_shifts table are accepted.
// "Reconciled" in the UI maps to the stored "matched" status.
export const shiftStatusFilters = ["open", "matched"] as const;

// "Unverified" covers every sign-off that is not verified (unverified + flagged).
export const shiftSignoffFilters = ["verified", "unverified"] as const;

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const isRealCalendarDate = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const isoDateQuery = (label: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
      .refine(isRealCalendarDate, `${label} is not a valid calendar date`)
      .optional()
  );

const enumQuery = <T extends readonly [string, ...string[]]>(
  values: T,
  label: string
) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(values, {
        errorMap: () => ({ message: `Invalid ${label} value` }),
      })
      .optional()
  );

export const listShiftsQuerySchema = z.object({
  staffId: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(64).optional()
  ),
  startDate: isoDateQuery("startDate"),
  endDate: isoDateQuery("endDate"),
  status: enumQuery(shiftStatusFilters, "status"),
  signoff: enumQuery(shiftSignoffFilters, "signoff"),
  sortBy: enumQuery(shiftSortFields, "sortBy"),
  sortDir: enumQuery(shiftSortDirections, "sortDir"),
});

export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
