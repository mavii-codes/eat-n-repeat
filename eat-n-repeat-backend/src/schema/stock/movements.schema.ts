import { z } from "zod";

export const MOVEMENT_TYPES = [
  "STOCK_IN",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "SALE_DEDUCTION",
  "OPENING_BALANCE",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

const movementTypeListSchema = z
  .string()
  .trim()
  .transform((raw) =>
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .refine(
    (values) => values.every((value) => (MOVEMENT_TYPES as readonly string[]).includes(value)),
    { message: "Unknown stock movement type." },
  );

export const stockInSchema = z
  .object({
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().min(0),
    receivedAt: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    supplier: z.string().trim().max(160).optional(),
    note: z.string().trim().max(255).optional(),
  })
  .refine(
    (data) => {
      if (!data.receivedAt || !data.expiryDate) return true;
      return new Date(data.expiryDate).getTime() >= new Date(data.receivedAt).getTime();
    },
    {
      message: "Expiry date cannot be earlier than the received date.",
      path: ["expiryDate"],
    },
  );

export const adjustSchema = z
  .object({
    direction: z.enum(["add", "remove"]),
    quantity: z.coerce.number().positive(),
    reason: z.enum([
      "Spoilage",
      "Waste",
      "Breakage",
      "Expired",
      "Recount correction",
      "Found extra",
      "Other",
    ]),
    note: z.string().trim().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === "Other" && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "A note is required when the reason is Other.",
      });
    }
  });

/** Cost a still-uncosted opening-balance layer (admin-only, one-time). */
export const setLayerCostSchema = z.object({
  unitCost: z.coerce
    .number({ invalid_type_error: "Unit cost is required." })
    .finite("Unit cost must be a valid number.")
    .min(0, "Unit cost cannot be negative.")
    .max(999999.99, "Unit cost is too large.")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      "Unit cost can have at most 2 decimal places.",
    ),
});

const PH_OFFSET = "+08:00";

/**
 * Query date bound: accepts a bare YYYY-MM-DD (native date pickers) or a full
 * ISO datetime (pass-through). Bare dates expand to the Philippine calendar
 * boundary (fixed UTC+8): from = 00:00:00, to = 23:59:59.999.
 */
export const phDateBoundSchema = (bound: "from" | "to") =>
  z.string().transform((value, ctx) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const probe = new Date(Date.UTC(year, month - 1, day));
      if (
        probe.getUTCFullYear() !== year ||
        probe.getUTCMonth() !== month - 1 ||
        probe.getUTCDate() !== day
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid calendar date.",
        });
        return z.NEVER;
      }
      return bound === "from"
        ? `${value}T00:00:00${PH_OFFSET}`
        : `${value}T23:59:59.999${PH_OFFSET}`;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      if (!z.string().datetime({ offset: true }).safeParse(value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid ISO datetime.",
        });
        return z.NEVER;
      }
      return value;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date must be YYYY-MM-DD or an ISO datetime.",
    });
    return z.NEVER;
  });

/* The admin history page uses native <input type="date"> pickers, which submit
   bare YYYY-MM-DD strings. phDateBoundSchema above accepts both bare dates and
   full ISO datetimes: a bare date is normalized to Philippine day boundaries
   (PH is fixed UTC+8, no DST) so `from` covers the whole PHT start-of-day and
   `to` the whole PHT end-of-day. Full datetimes pass through untouched. */
export const movementsQuerySchema = z.object({
  itemId: z.string().trim().max(64).optional(),
  type: movementTypeListSchema.optional(),
  from: phDateBoundSchema("from").optional(),
  to: phDateBoundSchema("to").optional(),
  staffId: z.string().trim().max(64).optional(),
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StockInInput = z.infer<typeof stockInSchema>;
export type AdjustInput = z.infer<typeof adjustSchema>;
export type SetLayerCostInput = z.infer<typeof setLayerCostSchema>;
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
