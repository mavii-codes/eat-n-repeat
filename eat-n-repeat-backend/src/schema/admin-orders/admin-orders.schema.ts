import { z } from "zod";

export const statusSchema = z.object({
  status: z.string(),
});

export const markPaymentSchema = z.object({
  method: z.string().optional(),
  cashReceived: z.coerce.number().optional(),
});

export type StatusInput = z.infer<typeof statusSchema>;
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;
