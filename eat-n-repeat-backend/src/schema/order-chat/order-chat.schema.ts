import { z } from "zod";

export const sendMessageSchema = z.object({
  orderId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const getMessagesParamsSchema = z.object({
  orderId: z.string().trim().min(1),
});

export type GetMessagesParams = z.infer<typeof getMessagesParamsSchema>;

export const markReadParamsSchema = z.object({
  orderId: z.string().trim().min(1),
});

export type MarkReadParams = z.infer<typeof markReadParamsSchema>;