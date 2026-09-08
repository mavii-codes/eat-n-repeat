import { z } from "zod";

export const xenditWebhookSchema = z.object({
  external_id: z.string(),
  status: z.string(),
  id: z.string().optional(),
  amount: z.coerce.number().optional(),
});

export type XenditWebhookInput = z.infer<typeof xenditWebhookSchema>;
