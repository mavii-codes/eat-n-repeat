import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().trim().min(1),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1).max(30),
  lowStockThreshold: z.coerce.number().min(0),
});

export const stockRequestInputSchema = z.object({
  ingredientId: z.string().trim().min(1),
  ingredientName: z.string().trim().min(1),
  currentQuantity: z.coerce.number(),
  unit: z.string().trim().min(1),
  threshold: z.coerce.number(),
  message: z.string().optional(),
  staffId: z.string().optional(),
  staffName: z.string().optional(),
});

export const stockRequestStatusSchema = z.object({
  status: z.enum(["Pending", "Approved", "Rejected"]),
  adminNote: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type StockRequestInput = z.infer<typeof stockRequestInputSchema>;
export type StockRequestStatusInput = z.infer<typeof stockRequestStatusSchema>;
