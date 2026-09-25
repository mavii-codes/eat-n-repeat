import { z } from "zod";

export const menuCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(255).optional().default(""),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().default(""),
  price: z.coerce.number().positive().max(1000000),
  categoryId: z.string().trim().min(1),
  available: z.coerce.boolean().optional().default(true),
  // Compressed data-URL photo (max ~2MB client-side) or remote URL.
  image: z.string().trim().max(3_000_000).optional().default(""),
});

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
