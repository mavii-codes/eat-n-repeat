import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  order_status: z.boolean().optional(),
  promotions: z.boolean().optional(),
  new_menu: z.boolean().optional(),
  announcements: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  avatar_url: z.string().trim().optional().nullable(),
  notification_preferences: notificationPreferencesSchema.optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
