import { Router } from "express";
import { getPool } from "../database.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/require-auth.js";
import type mysql from "mysql2/promise";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const customerId = req.auth?.userId;
    if (!customerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = getPool();
    // Fetch orders for this customer, joining with payments for payment status
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT o.*, p.status as payment_db_status, p.payment_method, p.xendit_reference, p.xendit_invoice_id, p.paid_at
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [customerId]
    );

    // Format them to match what the frontend expects
    const formattedOrders = rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      orderedAt: o.created_at,
      status: o.status,
      type: o.type,
      total: parseFloat(o.total || '0'),
      subtotal: parseFloat(o.subtotal || o.total || '0'),
      deliveryFee: parseFloat(o.delivery_fee || '0'),
      discount: parseFloat(o.discount || '0'),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_db_status,
      customerName: o.customer_name,
      phone: o.customer_phone,
      address: o.customer_address,
      items: o.items_snapshot,
      specialInstructions: o.special_instructions,
      estimatedDeliveryTime: o.estimated_delivery_time,
      deliveryPerson: o.delivery_person,
      assignedRole: o.assigned_role,
      assignedAt: o.assigned_at,
      cancelledBy: o.cancelled_by,
      cancelledAt: o.cancelled_at,
      xenditInvoiceId: o.xendit_invoice_id,
      xenditReference: o.xendit_reference
    }));

    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
