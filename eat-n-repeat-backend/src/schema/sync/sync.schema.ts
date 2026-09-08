import { z } from "zod";

// Individual record schemas — permissive passthrough to keep API contract identical
// Detailed fields are optional to accept existing local data shapes without strict rejection.

export const customerSyncSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().nullable().optional(),
    password_hash: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    created_at: z.coerce.date().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    notification_preferences: z.any().nullable().optional(),
  })
  .passthrough();

export const orderSyncSchema = z
  .object({
    id: z.string().min(1),
    order_number: z.string().optional(),
    customer_id: z.string().nullable().optional(),
    customer_name: z.string().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    service_area_id: z.string().nullable().optional(),
    type: z.string().optional(),
    items: z.any().optional(),
    subtotal: z.coerce.number().nullable().optional(),
    delivery_fee: z.coerce.number().nullable().optional(),
    total: z.coerce.number().nullable().optional(),
    status: z.string().nullable().optional(),
    delivery_person: z.string().nullable().optional(),
    assigned_role: z.string().nullable().optional(),
    assigned_at: z.coerce.date().nullable().optional(),
    estimated_delivery_time: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.coerce.date().nullable().optional(),
    delivered_at: z.coerce.date().nullable().optional(),
    archived: z.coerce.number().nullable().optional(),
  })
  .passthrough();

export const paymentSyncSchema = z
  .object({
    id: z.string().min(1),
    order_id: z.string().optional(),
    payment_method: z.string().optional(),
    xendit_invoice_id: z.string().nullable().optional(),
    xendit_reference: z.string().nullable().optional(),
    amount: z.coerce.number().nullable().optional(),
    status: z.string().nullable().optional(),
    paid_at: z.coerce.date().nullable().optional(),
    created_at: z.coerce.date().nullable().optional(),
  })
  .passthrough();

export const staffNotificationSyncSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    related_order_id: z.string().nullable().optional(),
    is_read: z.any().nullable().optional(),
    created_at: z.coerce.date().nullable().optional(),
  })
  .passthrough();

export const pushSyncSchema = z
  .object({
    orders: z.array(orderSyncSchema).optional().default([]),
    payments: z.array(paymentSyncSchema).optional().default([]),
    customers: z.array(customerSyncSchema).optional().default([]),
    staff_notifications: z.array(staffNotificationSyncSchema).optional().default([]),
  })
  .passthrough();

export const offlineOrderSchema = z
  .object({
    id: z.string().min(1),
    items: z.any().optional(),
    total: z.coerce.number().nullable().optional(),
    status: z.string().nullable().optional(),
    timestamp: z.coerce.date().nullable().optional(),
  })
  .passthrough();

export const offlineStockTransactionSchema = z
  .object({
    id: z.string().min(1),
    stockItemId: z.string().min(1),
    quantityDeducted: z.coerce.number(),
    orderId: z.string().optional(),
    staffId: z.string().optional(),
    timestamp: z.coerce.date().nullable().optional(),
  })
  .passthrough();

export const offlineSyncSchema = z
  .object({
    offline_orders: z.array(offlineOrderSchema).optional().default([]),
    offline_stock_transactions: z.array(offlineStockTransactionSchema).optional().default([]),
  })
  .passthrough();

export type PushSyncInput = z.infer<typeof pushSyncSchema>;
export type OfflineSyncInput = z.infer<typeof offlineSyncSchema>;
