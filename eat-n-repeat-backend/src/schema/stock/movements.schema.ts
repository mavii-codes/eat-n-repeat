import { z } from "zod";

export const MOVEMENT_TYPES = [
  "STOCK_IN",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "SALE_DEDUCTION",
  "SALE_CANCEL_RELEASE",
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

const PH_OFFSET = "+08:00";
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function getManilaDateString(date: Date): string {
  const manilaMs = date.getTime() + PH_OFFSET_MS;
  const d = new Date(manilaMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export type ParseDateResult =
  | { ok: true; date: Date; manilaDateStr: string; isoString: string }
  | { ok: false; message: string };

/**
 * Parses receivedAt:
 * - full ISO datetimes with offset (e.g. +08:00) or Z
 * - datetime-local format without offset/seconds (interpreting as Asia/Manila)
 * - validates calendar date and time
 * - validates clock skew (<= 10 minutes in future) and not before 2020
 */
export function parseReceivedAt(value: unknown): ParseDateResult {
  if (value == null || value === "") {
    const now = new Date();
    return {
      ok: true,
      date: now,
      manilaDateStr: getManilaDateString(now),
      isoString: now.toISOString(),
    };
  }

  if (typeof value !== "string") {
    return { ok: false, message: "Date received must be a valid date string." };
  }

  const str = value.trim();
  if (!str) {
    const now = new Date();
    return {
      ok: true,
      date: now,
      manilaDateStr: getManilaDateString(now),
      isoString: now.toISOString(),
    };
  }

  // Regex checks
  // Format 1: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss without offset
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const min = Number(localMatch[5]);
    const sec = Number(localMatch[6] || 0);

    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "Invalid calendar date." };
    }
    if (hour < 0 || hour > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) {
      return { ok: false, message: "Invalid time format." };
    }

    // Interpreted as Asia/Manila (UTC+8)
    const utcMs = Date.UTC(year, month - 1, day, hour, min, sec) - PH_OFFSET_MS;
    const date = new Date(utcMs);
    return checkReceivedAtBounds(date, `${year}-${pad2(month)}-${pad2(day)}`);
  }

  // Format 2: full ISO with Z or offset
  const isoOffsetMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.exec(str);
  if (isoOffsetMatch) {
    const year = Number(isoOffsetMatch[1]);
    const month = Number(isoOffsetMatch[2]);
    const day = Number(isoOffsetMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "Invalid calendar date." };
    }
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, message: "Invalid date and time." };
    }
    const manilaDateStr = getManilaDateString(date);
    return checkReceivedAtBounds(date, manilaDateStr);
  }

  return { ok: false, message: "Invalid date and time format." };
}

function checkReceivedAtBounds(date: Date, manilaDateStr: string): ParseDateResult {
  if (date.getUTCFullYear() < 2020) {
    return { ok: false, message: "Date received cannot be before 2020." };
  }
  const maxFuture = Date.now() + 10 * 60 * 1000; // 10 min clock-skew tolerance
  if (date.getTime() > maxFuture) {
    return { ok: false, message: "Date received cannot be more than 10 minutes in the future." };
  }
  return {
    ok: true,
    date,
    manilaDateStr,
    isoString: date.toISOString(),
  };
}

/**
 * Parses expiryDate:
 * - optional
 * - accepts plain YYYY-MM-DD
 * - tolerates full ISO datetime by taking the Manila date
 * - validates calendar date
 * - returns normalized date-only instant (UTC midnight of that date)
 */
export function parseExpiryDate(value: unknown): { ok: true; manilaDateStr: string; date: Date } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: false, message: "Expiry date is empty." };
  }

  if (typeof value !== "string") {
    return { ok: false, message: "Expiry date must be a string." };
  }

  const str = value.trim();
  if (!str) {
    return { ok: false, message: "Expiry date is empty." };
  }

  // Plain YYYY-MM-DD
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "Invalid calendar date." };
    }
    const manilaDateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    const date = new Date(`${manilaDateStr}T00:00:00.000Z`);
    return { ok: true, manilaDateStr, date };
  }

  // Full ISO format — tolerate by taking Manila date
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(str);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "Invalid calendar date." };
    }
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, message: "Invalid calendar date." };
    }
    const manilaDateStr = getManilaDateString(d);
    const date = new Date(`${manilaDateStr}T00:00:00.000Z`);
    return { ok: true, manilaDateStr, date };
  }

  return { ok: false, message: "Invalid calendar date." };
}

const quantitySchema = z.coerce
  .number({ invalid_type_error: "Quantity must be a valid number." })
  .refine((v) => Number.isFinite(v) && v > 0, "Quantity must be greater than 0.")
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    "Quantity can have at most 2 decimal places.",
  );

const unitCostSchema = z.coerce
  .number({ invalid_type_error: "Unit cost is required (0 or more)." })
  .refine((v) => Number.isFinite(v) && v >= 0, "Unit cost is required (0 or more).")
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    "Unit cost can have at most 2 decimal places.",
  );

export const stockInSchema = z
  .object({
    quantity: quantitySchema,
    unitCost: unitCostSchema,
    receivedAt: z.union([z.string(), z.date()]).optional(),
    expiryDate: z.union([z.string(), z.date()]).optional(),
    supplier: z.string().trim().max(160).optional(),
    note: z.string().trim().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    let receivedManilaDateStr = "";
    if (data.receivedAt != null && data.receivedAt !== "") {
      const parsedReceived = parseReceivedAt(
        typeof data.receivedAt === "string" ? data.receivedAt : data.receivedAt.toISOString(),
      );
      if (!parsedReceived.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receivedAt"],
          message: parsedReceived.message,
        });
        return;
      }
      receivedManilaDateStr = parsedReceived.manilaDateStr;
    } else {
      receivedManilaDateStr = getManilaDateString(new Date());
    }

    if (data.expiryDate != null && data.expiryDate !== "") {
      const parsedExpiry = parseExpiryDate(
        typeof data.expiryDate === "string" ? data.expiryDate : data.expiryDate.toISOString(),
      );
      if (!parsedExpiry.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiryDate"],
          message: parsedExpiry.message,
        });
        return;
      }

      // Comparison 1: Expiry date cannot be earlier than received date (Manila calendar dates)
      if (parsedExpiry.manilaDateStr < receivedManilaDateStr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiryDate"],
          message: "Expiry date can't be before the date received",
        });
        return;
      }

      // Comparison 2: Expiry in the past relative to today allowed ONLY if received date is also in the past
      const todayManilaStr = getManilaDateString(new Date());
      if (parsedExpiry.manilaDateStr < todayManilaStr && receivedManilaDateStr >= todayManilaStr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiryDate"],
          message: "Expiry date cannot be in the past unless date received is also in the past.",
        });
        return;
      }
    }
  });

export const adjustSchema = z
  .object({
    direction: z.preprocess(
      (v) => (v === "increase" ? "add" : v === "decrease" ? "remove" : v),
      z.enum(["add", "remove"]),
    ),
    quantity: quantitySchema,
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
    receivedAt: z.union([z.string(), z.date()]).optional(),
    expiryDate: z.union([z.string(), z.date()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === "Other" && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "A note is required when the reason is Other.",
      });
    }

    if (data.direction === "add") {
      let receivedManilaDateStr = "";
      if (data.receivedAt != null && data.receivedAt !== "") {
        const parsedReceived = parseReceivedAt(
          typeof data.receivedAt === "string" ? data.receivedAt : data.receivedAt.toISOString(),
        );
        if (!parsedReceived.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["receivedAt"],
            message: parsedReceived.message,
          });
          return;
        }
        receivedManilaDateStr = parsedReceived.manilaDateStr;
      } else {
        receivedManilaDateStr = getManilaDateString(new Date());
      }

      if (data.expiryDate != null && data.expiryDate !== "") {
        const parsedExpiry = parseExpiryDate(
          typeof data.expiryDate === "string" ? data.expiryDate : data.expiryDate.toISOString(),
        );
        if (!parsedExpiry.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expiryDate"],
            message: parsedExpiry.message,
          });
          return;
        }

        if (parsedExpiry.manilaDateStr < receivedManilaDateStr) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expiryDate"],
            message: "Expiry date can't be before the date received",
          });
          return;
        }

        const todayManilaStr = getManilaDateString(new Date());
        if (parsedExpiry.manilaDateStr < todayManilaStr && receivedManilaDateStr >= todayManilaStr) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expiryDate"],
            message: "Expiry date cannot be in the past unless date received is also in the past.",
          });
          return;
        }
      }
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

/**
 * Query date bound: accepts a bare YYYY-MM-DD (native date pickers) or a full
 * ISO datetime. Bare dates expand to the Philippine calendar boundary (fixed UTC+8):
 * from = 00:00:00, to = 23:59:59.999. Datetimes without offset are interpreted
 * as Asia/Manila wall-clock time.
 */
export const phDateBoundSchema = (bound: "from" | "to") =>
  z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      if (!isValidCalendarDate(year, month, day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid calendar date.",
        });
        return z.NEVER;
      }
      return bound === "from"
        ? `${trimmed}T00:00:00${PH_OFFSET}`
        : `${trimmed}T23:59:59.999${PH_OFFSET}`;
    }

    // Try parsing as ISO or datetime-local
    const parsed = parseReceivedAt(trimmed);
    if (!parsed.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date must be YYYY-MM-DD or an ISO datetime.",
      });
      return z.NEVER;
    }
    return parsed.isoString;
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
