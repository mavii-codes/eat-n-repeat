import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  address: z.string().trim().min(1),
  serviceAreaId: z.string().trim().optional(),
  items: z.string().trim().min(1),
  subtotal: z.coerce.number().min(0),
  deliveryFee: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  notes: z.string().optional(),
  selectedAddons: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().min(1),
      })
    )
    .optional()
    .default([]),
});

export const statusSchema = z.object({
  status: z.enum([
    "pending",
    "preparing",
    "ready_for_delivery",
    "assigned",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]),
});

export const personSchema = z.object({
  deliveryPerson: z.string(),
});

export const reassignSchema = z.object({
  personId: z.string(),
  note: z.string().optional(),
});

export const cancelSchema = z.object({
  cancelledBy: z.enum(["CUSTOMER", "STAFF"]).default("CUSTOMER"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type ReassignInput = z.infer<typeof reassignSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
