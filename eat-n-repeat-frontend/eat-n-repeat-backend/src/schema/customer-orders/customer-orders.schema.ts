import { z } from "zod";

export const emptySchema = z.object({});
export type EmptyInput = z.infer<typeof emptySchema>;
