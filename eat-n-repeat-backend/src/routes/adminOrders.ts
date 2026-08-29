import { Router } from "express";
import { getPool } from "../database.js";
import { requireAuth } from "../middleware/require-auth.js";
import type mysql from "mysql2/promise";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// Map DB row to admin dashboard object
const mapOrderToDashboard = (row: any) => {
  const paymentStatus =
    row.payment_db_status === "PENDING"
      ? "pending"
      : row.payment_db_status === "SUCCEEDED"
      ? "paid"
      : row.payment_db_status === "FAILED"
      ? "failed"
      : row.payment_db_status === "REFUNDED"
      ? "refunded"
      : "pending"; // For cash orders, they might not have a payment row if not created via GCash

  // Note: Cash orders create an order but not necessarily a xendit payment row immediately.
  // Actually, 'payments.ts' inserts into orders but only webhooks update 'payments' table.
  // Let's rely on paymentStatus mapping or manual flags.
  
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phone: row.phone || "",
    address: row.address || "",
    serviceAreaId: row.service_area_id || "",
    type: row.type,
    items: row.items,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    status: row.status === 'pending_payment' ? 'pending' : (row.status === 'awaiting_payment' ? 'awaiting_payment' : row.status),
    deliveryPerson: row.delivery_person,
    assignedRole: row.assigned_role,
    assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : undefined,
    orderedAt: new Date(row.created_at).toISOString(),
    archived: Boolean(row.archived),
    paymentMethod: row.payment_method || "Cash",
    paymentStatus: paymentStatus,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
  };
};

/* ── GET /api/admin-orders ── */
// Get all non-archived orders for the Staff Dashboard
router.get("/", async (_req, res) => {
  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      `SELECT o.*, p.status as payment_db_status, p.payment_method, p.xendit_reference, p.xendit_invoice_id, p.paid_at
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.archived = FALSE
       ORDER BY o.created_at DESC`
    );

    const orders = rows.map(mapOrderToDashboard);
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ── PATCH /api/admin-orders/:id/status ── */
// Update order status (for delivery or store orders)
const statusSchema = z.object({
  status: z.string(), // "preparing", "out_for_delivery", "completed", "cancelled", etc.
});

router.patch("/:id/status", async (req, res) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const { status } = parsed.data;
    const pool = getPool();
    
    // 1. Fetch current order
    const [existingRows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
      [req.params.id, req.params.id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const orderRow = existingRows[0];
    const orderId = orderRow.id;

    // 2. Map timestamp columns if status corresponds to a specific lifecycle event
    let timeCol = "";
    if (status === "preparing") timeCol = "preparing_at";
    else if (status === "ready_for_delivery" || status === "completed") timeCol = "ready_for_delivery_at";
    else if (status === "out_for_delivery") timeCol = "out_for_delivery_at";
    else if (status === "delivered" || status === "completed") timeCol = "delivered_at";
    else if (status === "cancelled") timeCol = "cancelled_at";

    // 3. Update order
    if (timeCol) {
      await pool.execute(
        `UPDATE orders SET status = ?, ${timeCol} = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, orderId]
      );
    } else {
      await pool.execute(
        `UPDATE orders SET status = ? WHERE id = ?`,
        [status, orderId]
      );
    }

    // 4. Notify customer (Optional, done by webhooks if needed, but we can emit a simple notification)
    const title = "Order Status Updated";
    const message = `Your order ${orderRow.order_number} is now ${status.replace(/_/g, ' ')}`;
    if (orderRow.customer_id) {
        try {
            await pool.execute(
              "INSERT INTO customer_notifications (id, customer_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
              [`notif-${Date.now()}`, orderRow.customer_id, "order", title, message]
            );
        } catch (e) { console.error("Could not notify customer", e); }
    }

    res.json({ success: true, message: "Order status updated" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ── PATCH /api/admin-orders/:id/payment ── */
// Mark order as paid manually
router.patch("/:id/payment", requireAuth, async (req: any, res) => {
  try {
    const pool = getPool();
    const [existingRows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
      [req.params.id, req.params.id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Insert or update payment row
    const orderId = existingRows[0].id;
    const [payRows] = await pool.execute<mysql.RowDataPacket[]>("SELECT * FROM payments WHERE order_id = ?", [orderId]);
    if (payRows.length > 0) {
      await pool.execute("UPDATE payments SET status = 'SUCCEEDED', paid_at = CURRENT_TIMESTAMP WHERE order_id = ?", [orderId]);
    } else {
      await pool.execute(
        "INSERT INTO payments (id, order_id, amount, status, payment_method, paid_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [`pay-${Date.now()}`, orderId, existingRows[0].total, "SUCCEEDED", "Cash"]
      );
    }
    
    const { method, cashReceived } = req.body;
    const isPhysicalCash = method === 'Cash' || !method; // default to cash if manual
    const totalAmount = parseFloat(existingRows[0].total);

    let change = 0;

    if (isPhysicalCash) {
      if (typeof cashReceived !== 'number' || cashReceived < totalAmount) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient payment. Need ₱${(totalAmount - (cashReceived || 0)).toFixed(2)} more.` 
        });
      }
      
      change = cashReceived - totalAmount;
      const userId = req.user?.id;

      // Validate active cash shift
      if (userId) {
        const [openShifts] = await pool.execute<mysql.RowDataPacket[]>(
          "SELECT * FROM cash_shifts WHERE staff_id = ? AND status = 'open' LIMIT 1",
          [userId]
        );

        if (openShifts.length === 0) {
          return res.status(403).json({ 
            success: false, 
            message: "Please start your cash shift before processing cash payments." 
          });
        }

        const shiftId = openShifts[0].id;
        const currentExpected = parseFloat(openShifts[0].expected_cash);

        // Update shift expected cash
        await pool.execute(
          "UPDATE cash_shifts SET expected_cash = ? WHERE id = ?",
          [currentExpected + totalAmount, shiftId]
        );

        // Record cash transaction
        await pool.execute(
          "INSERT INTO cash_transactions (id, shift_id, order_id, type, amount) VALUES (?, ?, ?, 'sale', ?)",
          [`cashtx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, shiftId, orderId, totalAmount]
        );
      }
    }

    // If order was pending_payment or awaiting_payment, make it confirmed for dine-in, or pending otherwise
    if (existingRows[0].status === 'pending_payment' || existingRows[0].status === 'awaiting_payment') {
        const newStatus = existingRows[0].type === 'dine-in' ? 'confirmed' : 'pending';
        await pool.execute("UPDATE orders SET status = ? WHERE id = ?", [newStatus, orderId]);
    } else if (existingRows[0].status === 'pending' && existingRows[0].type === 'dine-in') {
        // Just in case older pending dine-in orders exist
        await pool.execute("UPDATE orders SET status = 'confirmed' WHERE id = ?", [orderId]);
    }

    res.json({ success: true, message: "Order marked as paid", change });
  } catch (error) {
    console.error("Error marking order as paid:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
