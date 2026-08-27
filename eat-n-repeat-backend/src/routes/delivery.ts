import { randomUUID } from "node:crypto";
import { Router } from "express";
import mysql from "mysql2/promise";
import { z } from "zod";
import { getPool } from "../database.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/require-auth.js";
import { notifyAllStaff } from "./staffNotifications.js";

const router = Router();
router.use(requireAuth);

/* ── Helper: Backend Delivery Person Assignment Logic ── */
export function determineDeliveryPerson(date: Date = new Date()): {
  person: "Delivery Rider" | "Café Owner";
  role: "Rider" | "Owner";
  label: "Rider Available" | "Owner Delivery";
} {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    return {
      person: "Delivery Rider",
      role: "Rider",
      label: "Rider Available",
    };
  } else {
    return {
      person: "Café Owner",
      role: "Owner",
      label: "Owner Delivery",
    };
  }
}

import { emitPaymentEvent } from "./events.js";

const deliveryOrderResponse = (row: any) => {
  const createdAtDate = row.created_at ? new Date(row.created_at) : new Date();
  const defaultAssignment = determineDeliveryPerson(createdAtDate);
  const deliveryPerson = row.delivery_person || defaultAssignment.person;
  const isOwner = deliveryPerson === "Café Owner" || row.assigned_role === "Owner";
  const deliveryPersonType = isOwner ? "OWNER" : "RIDER";
  const assignedRole = isOwner ? "Café Owner" : "Delivery Rider";

  const rawPaymentStatus = (row.payment_db_status || row.payment_status || "").toUpperCase();
  const paymentStatus =
    rawPaymentStatus === "PAID" || rawPaymentStatus === "SETTLED" || rawPaymentStatus === "COMPLETED"
      ? "paid"
      : rawPaymentStatus === "FAILED"
      ? "failed"
      : rawPaymentStatus === "REFUNDED"
      ? "refunded"
      : "pending";

  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phone: row.phone || "",
    address: row.address || "",
    serviceAreaId: row.service_area_id || "",
    items: row.items,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    status: row.status,
    deliveryPerson,
    deliveryPersonType,
    assignedRole,
    assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : createdAtDate.toISOString(),
    estimatedDeliveryTime: row.estimated_delivery_time || "15–25 min",
    notes: row.notes || "",
    orderedAt: createdAtDate.toISOString(),
    pendingAt: row.pending_at ? new Date(row.pending_at).toISOString() : undefined,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
    preparingAt: row.preparing_at ? new Date(row.preparing_at).toISOString() : undefined,
    readyForDeliveryAt: row.ready_for_delivery_at ? new Date(row.ready_for_delivery_at).toISOString() : undefined,
    outForDeliveryAt: row.out_for_delivery_at ? new Date(row.out_for_delivery_at).toISOString() : undefined,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : undefined,
    archived: Boolean(row.archived),
    cancelledBy: row.cancelled_by || undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined,
    paymentMethod: row.payment_method || "Cash on Delivery",
    paymentStatus,
    xenditReference: row.xendit_reference || undefined,
    xenditInvoiceId: row.xendit_invoice_id || undefined,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
  };
};

/* ── GET /api/delivery/orders ── */
router.get("/orders", async (_req, res) => {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    `SELECT o.*, p.status as payment_db_status, p.payment_method, p.xendit_reference, p.xendit_invoice_id, p.paid_at
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.type = 'delivery'
     ORDER BY o.created_at DESC`
  );
  return res.json({ orders: rows.map(deliveryOrderResponse) });
});

/* ── POST /api/delivery/orders ── */
const createOrderSchema = z.object({
  customerName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  address: z.string().trim().min(1),
  serviceAreaId: z.string().trim().optional(),
  items: z.string().trim().min(1),
  subtotal: z.coerce.number().min(0), // Food subtotal
  deliveryFee: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0), // Final total sent by frontend (to validate)
  notes: z.string().optional(),
  selectedAddons: z.array(z.object({
    id: z.string(),
    quantity: z.number().min(1)
  })).optional().default([]),
});

router.post("/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid delivery order details." });
  }

  let { customerName, phone, address, serviceAreaId, items, subtotal, deliveryFee, total, notes, selectedAddons } = parsed.data;
  
  const pool = getPool();
  
  // Validate Add-ons
  let addonsTotal = 0;
  if (selectedAddons.length > 0) {
    const addonIds = selectedAddons.map(a => a.id);
    const placeholders = addonIds.map(() => '?').join(',');
    const [rows] = await pool.execute<any[]>(
      `SELECT id, name, price FROM addons WHERE id IN (${placeholders})`,
      addonIds
    );
    
    const dbAddonsMap = new Map(rows.map(r => [r.id, r]));
    
    for (const addon of selectedAddons) {
      const dbAddon = dbAddonsMap.get(addon.id);
      if (!dbAddon) {
        return res.status(400).json({ message: `Invalid addon: ${addon.id}` });
      }
      addonsTotal += Number(dbAddon.price) * addon.quantity;
      items += `, ${dbAddon.name} x${addon.quantity}`;
    }
  }

  // Validate Final Total
  const expectedTotal = subtotal + addonsTotal + deliveryFee;
  if (Math.abs(expectedTotal - total) > 0.01) {
    return res.status(400).json({ message: "Total amount mismatch." });
  }

  const id = `do-${randomUUID()}`;
  const now = new Date();
  const orderNumber = `DEL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(100 + Math.random() * 900)}`;

  // Automatically determine delivery person based on current weekday/weekend logic
  const assignment = determineDeliveryPerson(now);

  const customerId = req.auth?.userId;

  await getPool().execute(
    `INSERT INTO orders 
     (id, order_number, customer_id, customer_name, phone, address, service_area_id, type, items, subtotal, delivery_fee, total, status, delivery_person, assigned_role, assigned_at, estimated_delivery_time, notes, created_at, pending_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'delivery', ?, ?, ?, ?, 'pending', ?, ?, ?, '15–25 min', ?, ?, ?, FALSE)`,
    [
      id,
      orderNumber,
      customerId || null,
      customerName,
      phone || null,
      address,
      serviceAreaId || null,
      items,
      subtotal,
      deliveryFee,
      total,
      assignment.person,
      assignment.role,
      now,
      notes || null,
      now,
      now,
    ]
  );

  // Notify all staff of the new delivery order
  const notesText = notes ? `\nNote: ${notes}` : "";
  await notifyAllStaff(
    "delivery",
    "NEW DELIVERY ORDER",
    `Order #${orderNumber}\nCustomer: ${customerName}\nAddress: ${address}\nTotal: ₱${total.toFixed(2)}\nFee: ₱${deliveryFee.toFixed(2)}${notesText}`,
    id
  );

  return res.status(201).json({
    order: {
      id,
      orderNumber,
      customerName,
      phone: phone || "",
      address,
      serviceAreaId: serviceAreaId || "",
      items,
      subtotal,
      deliveryFee,
      total,
      status: "pending",
      deliveryPerson: assignment.person,
      assignedRole: assignment.role,
      assignedAt: now.toISOString(),
      estimatedDeliveryTime: "15–25 min",
      notes: notes || "",
      orderedAt: now.toISOString(),
      archived: false,
    },
  });
});

/* ── PATCH /api/delivery/orders/:id/status ── */
const statusSchema = z.object({
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

router.patch("/orders/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid delivery status." });
  }

  const { status } = parsed.data;
  
  // 1. Fetch current order
  const [existingRows] = await getPool().execute<mysql.RowDataPacket[]>(
    "SELECT * FROM orders WHERE id = ? LIMIT 1",
    [req.params.id]
  );
  
  if (existingRows.length === 0) {
    return res.status(404).json({ message: "Delivery order not found." });
  }
  
  const currentOrder = existingRows[0];
  
  // 2. Validate Transitions
  if (status === "delivered" && !currentOrder.out_for_delivery_at) {
    return res.status(400).json({ message: "Cannot mark as delivered before out for delivery." });
  }
  
  if (currentOrder.status === "delivered" && status !== "delivered") {
     return res.status(400).json({ message: "Cannot change status of an already delivered order." });
  }

  // 3. Determine timestamp field and value
  const now = new Date();
  let updateTimestampQuery = "";
  let queryParams: any[] = [status];

  if (status === "pending") {
    updateTimestampQuery = ", pending_at = COALESCE(pending_at, ?)";
    queryParams.push(now);
  } else if (status === "preparing") {
    updateTimestampQuery = ", preparing_at = COALESCE(preparing_at, ?)";
    queryParams.push(now);
  } else if (status === "ready_for_delivery" || status === "assigned") {
    updateTimestampQuery = ", ready_for_delivery_at = COALESCE(ready_for_delivery_at, ?)";
    queryParams.push(now);
  } else if (status === "out_for_delivery") {
    updateTimestampQuery = ", out_for_delivery_at = COALESCE(out_for_delivery_at, ?)";
    queryParams.push(now);
  } else if (status === "delivered") {
    updateTimestampQuery = ", delivered_at = COALESCE(delivered_at, ?)";
    queryParams.push(now);
  } else if (status === "cancelled") {
    updateTimestampQuery = ", cancelled_at = COALESCE(cancelled_at, ?)";
    queryParams.push(now);
  }

  queryParams.push(req.params.id);

  await getPool().execute(
    `UPDATE orders SET status = ?${updateTimestampQuery} WHERE id = ?`,
    queryParams
  );

  // Notify staff about the status change
  let statusText: string = status;
  if (status === "preparing") statusText = "Preparing";
  if (status === "ready_for_delivery" || status === "assigned") statusText = "Ready for Delivery";
  if (status === "out_for_delivery") statusText = "Out for Delivery";
  if (status === "delivered") statusText = "Delivered";
  
  if (status !== "pending") {
    const message = status === "delivered" 
      ? `Order #${currentOrder.order_number} has been delivered successfully.`
      : (status === "out_for_delivery" 
         ? `Order #${currentOrder.order_number} is now out for delivery.`
         : `Order #${currentOrder.order_number} is ${statusText.toLowerCase()}.`);
         
    await notifyAllStaff(
      "status",
      statusText,
      message,
      req.params.id
    );
  }

  const [updatedRows] = await getPool().execute<mysql.RowDataPacket[]>(
    `SELECT o.*, p.status as payment_db_status, p.payment_method, p.xendit_reference, p.xendit_invoice_id, p.paid_at 
     FROM orders o LEFT JOIN payments p ON p.order_id = o.id 
     WHERE o.id = ? LIMIT 1`,
    [req.params.id]
  );

  return res.json({ order: deliveryOrderResponse(updatedRows[0]) });
});

/* ── PATCH /api/delivery/orders/:id/person (Manual Reassignment) ── */
const personSchema = z.object({
  deliveryPerson: z.string(),
});

router.patch("/orders/:id/person", async (req, res) => {
  const parsed = personSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid delivery person." });
  }

  const { deliveryPerson } = parsed.data;
  const assignedRole = deliveryPerson === "Delivery Rider" ? "Rider" : "Owner";
  const now = new Date();

  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    "UPDATE orders SET delivery_person = ?, assigned_role = ?, assigned_at = ? WHERE id = ?",
    [deliveryPerson, assignedRole, now, req.params.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Delivery order not found." });
  }

  const [rows] = await getPool().execute<mysql.RowDataPacket[]>(
    "SELECT * FROM orders WHERE id = ? LIMIT 1",
    [req.params.id]
  );

  return res.json({ order: deliveryOrderResponse(rows[0]) });
});

/* ── PATCH /api/delivery/orders/:id/reassign ── */
const reassignSchema = z.object({
  personId: z.string(),
  note: z.string().optional(),
});

router.patch("/orders/:id/reassign", async (req, res) => {
  const parsed = reassignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid reassignment payload." });
  }

  const { personId } = parsed.data;
  const now = new Date();

  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    "UPDATE orders SET delivery_person = ?, assigned_at = ? WHERE id = ?",
    [personId, now, req.params.id]
  );

  return res.json({ success: true, orderId: req.params.id, personId });
});

/* ── PATCH /api/delivery/orders/:id/cancel ── */
const cancelSchema = z.object({
  cancelledBy: z.enum(["CUSTOMER", "STAFF"]).default("CUSTOMER"),
});

router.patch("/orders/:id/cancel", async (req, res) => {
  try {
    const parsed = cancelSchema.safeParse(req.body);
    const cancelledBy = parsed.success ? parsed.data.cancelledBy : "CUSTOMER";
    const orderId = req.params.id;
    const pool = getPool();

    // Check existing order
    const [existingRows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
      [orderId, orderId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    const order = existingRows[0];

    // Case 6 & Case 7: Validation
    if (order.status === "delivered") {
      return res.status(400).json({ message: "Delivered orders cannot be cancelled." });
    }
    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled." });
    }

    const now = new Date();

    // Update database order status while PRESERVING payments table!
    await pool.execute(
      "UPDATE orders SET status = 'cancelled', cancelled_by = ?, cancelled_at = ? WHERE id = ?",
      [cancelledBy, now, order.id]
    );

    // Fetch updated order info with payment details
    const [updatedRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT o.*, p.status as payment_db_status, p.payment_method, p.xendit_reference, p.xendit_invoice_id, p.paid_at
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = ? LIMIT 1`,
      [order.id]
    );

    const formattedOrder = deliveryOrderResponse(updatedRows[0]);

    // Broadcast SSE Notification to Staff
    emitPaymentEvent({
      type: "ORDER_CANCELLED",
      order: formattedOrder,
      message: `Order ${formattedOrder.orderNumber} was cancelled by the ${cancelledBy.toLowerCase()}.`,
    });

    return res.json({ success: true, order: formattedOrder });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Failed to cancel order." });
  }
});

export default router;
