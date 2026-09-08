import { z } from "zod";

export const addFavoriteSchema = z.object({
  menuItemId: z.string().trim().min(1),
});

export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;
