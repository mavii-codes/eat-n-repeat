import { z } from "zod";

export const statusSchema = z.object({
  status: z.string(),
});

// Staff order-history listing: server-side pagination + search + status.
// All fields optional with safe defaults so existing callers (full-list
// GET /) are unaffected.
export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "completed", "cancelled"]).optional().default("all"),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;

export const markPaymentSchema = z.object({
  method: z.string().optional(),
  cashReceived: z.coerce.number().optional(),
});

export type StatusInput = z.infer<typeof statusSchema>;
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;
