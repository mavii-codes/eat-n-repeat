import { z } from "zod";

export const staffSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  role: z.enum(["admin", "head_staff", "staff", "delivery_rider"]),
  status: z.enum(["active", "inactive"]),
  archived: z.boolean().optional().default(false),
});

export type StaffInput = z.infer<typeof staffSchema>;
