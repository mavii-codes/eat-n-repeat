import { z } from "zod";

export const startShiftSchema = z.object({
  startingFloat: z.number().min(0, "Invalid starting float"),
});

export const endShiftSchema = z.object({
  shiftId: z.string().min(1, "shiftId is required"),
  actualCash: z.number().min(0, "Invalid actual cash amount"),
});

export const addFloatSchema = z.object({
  amount: z.number().positive("Invalid amount"),
  reason: z.string().min(1, "Reason is required"),
});

export type StartShiftInput = z.infer<typeof startShiftSchema>;
export type EndShiftInput = z.infer<typeof endShiftSchema>;
export type AddFloatInput = z.infer<typeof addFloatSchema>;
