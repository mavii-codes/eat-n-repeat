import { z } from "zod";

export const selectedAddonSchema = z.object({
  id: z.string(),
  quantity: z.coerce.number().int().min(1),
  name: z.string().optional(),
  price: z.coerce.number().optional(),
});

export const orderDetailsSchema = z.object({
  orderNumber: z.string().optional(),
  selectedAddons: z.array(selectedAddonSchema).optional().default([]),
  items: z.string(),
  subtotal: z.coerce.number(),
  deliveryFee: z.coerce.number().optional().default(0),
  total: z.coerce.number(),
  customerName: z.string(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  serviceAreaId: z.string().optional().nullable(),
  type: z.string().optional().default("delivery"),
  notes: z.string().optional().nullable(),
});

export const checkoutSchema = z.object({
  orderDetails: orderDetailsSchema,
  paymentMethod: z.string(),
  orderMode: z.enum(["online", "local"]).optional().default("online"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderDetailsInput = z.infer<typeof orderDetailsSchema>;
export type SelectedAddonInput = z.infer<typeof selectedAddonSchema>;
