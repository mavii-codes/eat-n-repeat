import { z } from "zod";

export const markReadParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type MarkReadParams = z.infer<typeof markReadParamsSchema>;
