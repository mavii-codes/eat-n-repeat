import { z } from "zod";

export const addonSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().min(0),
  available: z.boolean().default(true),
});

export type AddonInput = z.infer<typeof addonSchema>;
