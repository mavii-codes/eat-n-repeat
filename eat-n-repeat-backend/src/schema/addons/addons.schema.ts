import { z } from "zod";

export const addonSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().min(0),
  available: z.boolean().default(true),
  image: z.string().trim().max(3000000, "Image is too large.").optional(),
});

export type AddonInput = z.infer<typeof addonSchema>;
