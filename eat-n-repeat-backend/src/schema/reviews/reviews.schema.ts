import { z } from "zod";

export const createReviewSchema = z.object({
  menuItemId: z.string().min(1, "Menu item is required."),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().default(""),
  orderId: z.string().min(1).optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

export const visibilitySchema = z.object({
  hidden: z.boolean(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
