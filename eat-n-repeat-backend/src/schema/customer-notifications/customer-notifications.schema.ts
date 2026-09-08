import { z } from "zod";

export const createCustomerNotificationSchema = z.object({
  type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

export type CreateCustomerNotificationInput = z.infer<typeof createCustomerNotificationSchema>;
