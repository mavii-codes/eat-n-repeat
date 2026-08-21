import { Router } from "express";
import { Xendit } from "xendit-node";
import { config } from "../config.js";
import { getPool } from "../database.js";
import crypto from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/require-auth.js";
import { notifyAllStaff } from "./staffNotifications.js";

const router = Router();
const xenditClient = new Xendit({ secretKey: config.xendit.secretKey });
const { Invoice } = xenditClient;

import dns from "dns/promises";

router.post("/checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    let { orderDetails, paymentMethod } = req.body;
    
    // Offline detection for GCash
    if (paymentMethod === "GCash") {
      try {
        await dns.resolve("api.xendit.co");
      } catch (e) {
        return res.status(503).json({ success: false, error: "Online payment is temporarily unavailable because the café is offline." });
      }
    }

    const customerId = req.auth?.userId;
    const pool = getPool();
    const orderId = crypto.randomUUID();
    const orderNumber = orderDetails.orderNumber || `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    let addonsTotal = 0;
    let selectedAddons = orderDetails.selectedAddons || [];
    if (selectedAddons.length > 0) {
      const addonIds = selectedAddons.map((a: any) => a.id);
      const placeholders = addonIds.map(() => '?').join(',');
      const [rows] = await pool.execute<any[]>(
        `SELECT id, name, price FROM addons WHERE id IN (${placeholders})`,
        addonIds
      );
      
      const dbAddonsMap = new Map(rows.map(r => [r.id, r]));
      
      for (const addon of selectedAddons) {
        const dbAddon = dbAddonsMap.get(addon.id);
        if (!dbAddon) {
          return res.status(400).json({ success: false, error: `Invalid addon: ${addon.id}` });
        }
        addonsTotal += Number(dbAddon.price) * addon.quantity;
        orderDetails.items += `, ${dbAddon.name} x${addon.quantity}`;
      }
    }

    const expectedTotal = Number(orderDetails.subtotal) + addonsTotal + Number(orderDetails.deliveryFee || 0);
    if (Math.abs(expectedTotal - Number(orderDetails.total)) > 0.01) {
      return res.status(400).json({ success: false, error: "Total amount mismatch." });
    }

    // Insert order
    await pool.execute(
      `INSERT INTO orders (id, order_number, customer_id, customer_name, phone, address, service_area_id, type, items, subtotal, delivery_fee, total, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, orderNumber, customerId || null, orderDetails.customerName, orderDetails.phone || null, orderDetails.address || null,
        orderDetails.serviceAreaId || null, orderDetails.type || 'delivery', orderDetails.items,
        orderDetails.subtotal, orderDetails.deliveryFee || 0, orderDetails.total,
        'pending', orderDetails.notes || null
      ]
    );

    // Notify staff of the new order
    const typeLabel = orderDetails.type === "dine-in" ? "Dine-in" : (orderDetails.type === "pickup" ? "Pickup" : "Delivery");
    const notesText = orderDetails.notes ? `\nNotes: ${orderDetails.notes}` : "";
    let messageText = `Order #${orderNumber}\nCustomer: ${orderDetails.customerName}\nTotal: ₱${orderDetails.total.toFixed(2)}`;
    
    if (orderDetails.type === "dine-in") {
      messageText += `\nTable: ${orderDetails.address || "Counter"}`;
    } else if (orderDetails.type === "delivery") {
      messageText += `\nAddress: ${orderDetails.address || "Unknown"}`;
      messageText += `\nFee: ₱${(orderDetails.deliveryFee || 0).toFixed(2)}`;
    }
    messageText += notesText;

    await notifyAllStaff(
      orderDetails.type || 'delivery',
      `New ${typeLabel} Order`,
      messageText,
      orderId
    );

    if (paymentMethod === "GCash") {
      const paymentId = crypto.randomUUID();
      const referenceId = `REF-${orderNumber}-${Date.now()}`;

      const invoiceRequest = {
        externalId: referenceId,
        amount: orderDetails.total,
        payerEmail: "customer@eatnrepeat.com",
        description: `Payment for Order ${orderNumber}`,
        successRedirectUrl: `${config.clientOrigin}/customer/orders?success=true&order=${orderNumber}`,
        failureRedirectUrl: `${config.clientOrigin}/customer/orders?success=false&order=${orderNumber}`,
        paymentMethods: ["GCASH"]
      };

      const invoice = await Invoice.createInvoice({ data: invoiceRequest });

      await pool.execute(
        `INSERT INTO payments (id, order_id, payment_method, xendit_invoice_id, xendit_reference, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, orderId, paymentMethod, invoice.id, referenceId, orderDetails.total, invoice.status]
      );

      return res.json({ success: true, invoiceUrl: invoice.invoiceUrl, orderId: orderId });
    } else {
      return res.json({ success: true, orderId: orderId });
    }
  } catch (error) {
    console.error("Error creating checkout:", error);
    res.status(500).json({ success: false, error: "Failed to process checkout" });
  }
});

/* ── GET /api/payments/order/:orderId ── */
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const pool = getPool();

    const [rows] = await pool.execute<any[]>(
      `SELECT p.*, o.order_number, o.customer_name, o.created_at as order_created_at
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE p.order_id = ? OR o.order_number = ?
       ORDER BY p.created_at DESC LIMIT 1`,
      [orderId, orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No payment record found." });
    }

    const payment = rows[0];
    const rawStatus = (payment.status || "").toUpperCase();
    const paymentStatus =
      rawStatus === "PAID" || rawStatus === "SETTLED" || rawStatus === "COMPLETED"
        ? "paid"
        : rawStatus === "EXPIRED" || rawStatus === "CANCELLED"
        ? "cancelled"
        : rawStatus === "FAILED"
        ? "failed"
        : "pending";

    return res.json({
      success: true,
      payment: {
        id: payment.id,
        orderId: payment.order_id,
        orderNumber: payment.order_number,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method || "GCash",
        xenditInvoiceId: payment.xendit_invoice_id,
        xenditReference: payment.xendit_reference,
        amount: Number(payment.amount),
        status: paymentStatus,
        rawStatus: payment.status,
        paidAt: payment.paid_at ? new Date(payment.paid_at).toISOString() : null,
        createdAt: new Date(payment.created_at).toISOString(),
        orderCreatedAt: new Date(payment.order_created_at).toISOString(),
        verifiedVia: "Xendit Sandbox API",
      },
    });
  } catch (error) {
    console.error("Error fetching order payment details:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment details" });
  }
});

export default router;
