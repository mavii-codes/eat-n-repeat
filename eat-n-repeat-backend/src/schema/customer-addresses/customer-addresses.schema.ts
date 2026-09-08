import { z } from "zod";

export const createAddressSchema = z.object({
  address_name: z.string().trim().min(1, "address_name is required"),
  full_address: z.string().trim().min(1, "full_address is required"),
  barangay: z.string().trim().min(1, "barangay is required"),
  municipality: z.string().trim().min(1, "municipality is required"),
  landmarks: z.string().trim().optional().nullable(),
  delivery_notes: z.string().trim().optional().nullable(),
});

export const updateAddressSchema = z.object({
  address_name: z.string().trim().min(1).optional(),
  full_address: z.string().trim().min(1).optional(),
  barangay: z.string().trim().min(1).optional(),
  municipality: z.string().trim().min(1).optional(),
  landmarks: z.string().trim().optional().nullable(),
  delivery_notes: z.string().trim().optional().nullable(),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
