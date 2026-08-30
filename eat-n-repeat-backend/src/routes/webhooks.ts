import { Router } from "express";
import { config } from "../config.js";
import { getPool } from "../database.js";
import { emitPaymentEvent } from "./events.js";
import { notifyAllStaff } from "./staffNotifications.js";

const router = Router();

router.post("/xendit", async (req, res) => {
  try {
    const webhookToken = req.headers['x-callback-token'];
    
    // Verify webhook token if configured
    if (config.xendit.webhookToken && webhookToken !== config.xendit.webhookToken) {
      return res.status(401).json({ error: "Invalid webhook token" });
    }

    const event = req.body;
    const pool = getPool();

    // Event contains external_id and status
    if (event && event.external_id) {
      const referenceId = event.external_id;
      const status = event.status; // e.g. PAID, EXPIRED

      // Find the payment by referenceId
      const [payments] = await pool.execute<any[]>(
        "SELECT id, order_id FROM payments WHERE xendit_reference = ?",
        [referenceId]
      );

      if (payments.length > 0) {
        const payment = payments[0];
        
        // Fetch current order status first to check if it was cancelled
        const [existingOrders] = await pool.execute<any[]>(
          "SELECT status, type FROM orders WHERE id = ?",
          [payment.order_id]
        );
        const orderData = existingOrders.length > 0 ? existingOrders[0] : null;
        const wasCancelled = orderData && orderData.status === 'cancelled';
        const orderType = orderData ? orderData.type : 'delivery';

        // Update payment status
        await pool.execute(
          "UPDATE payments SET status = ?, paid_at = ? WHERE id = ?",
          [status, status === 'PAID' ? new Date() : null, payment.id]
        );

        // Update order status if paid
        if (status === 'PAID') {
          await pool.execute(
            "UPDATE orders SET status = 'confirmed' WHERE id = ?",
            [payment.order_id]
          );
        } else if (status === 'EXPIRED' || status === 'FAILED') {
          const revertStatus = orderType === 'dine-in' ? 'awaiting_payment' : 'pending_payment';
          await pool.execute(
            "UPDATE orders SET status = ? WHERE id = ?",
            [revertStatus, payment.order_id]
          );
        }

        // Fetch updated order info to broadcast
        const [orders] = await pool.execute<any[]>(
          "SELECT * FROM orders WHERE id = ?",
          [payment.order_id]
        );

        if (orders.length > 0) {
          const updatedOrder = orders[0];
          
          if (status === 'PAID') {
            // Full notification for GCash-paid orders
            const typeLabel = updatedOrder.type === "dine-in" ? "Dine-in" : (updatedOrder.type === "pickup" ? "Pickup" : "Delivery");
            
            // Highlight if it's a late payment after expiry
            const titlePrefix = wasCancelled ? "LATE PAYMENT RECEIVED" : `NEW ${typeLabel.toUpperCase()} ORDER`;
            
            let paidMessage = `Order #${updatedOrder.order_number} — Payment Received!\nCustomer: ${updatedOrder.customer_name}\nAmount: ₱${Number(updatedOrder.total).toFixed(2)}\nType: ${typeLabel}`;
            
            if (wasCancelled) {
              paidMessage = `⚠️ PAID AFTER EXPIRY\n${paidMessage}\nStaff: Please verify and prepare this order as payment was successful.`;
            }

            if (updatedOrder.type === "delivery" && updatedOrder.address) {
              paidMessage += `\nAddress: ${updatedOrder.address}`;
            } else if (updatedOrder.type === "dine-in" && updatedOrder.address) {
              paidMessage += `\nTable: ${updatedOrder.address}`;
            }
            if (updatedOrder.notes) {
              paidMessage += `\nNotes: ${updatedOrder.notes}`;
            }

            await notifyAllStaff(
              updatedOrder.type || 'payment',
              titlePrefix,
              paidMessage,
              updatedOrder.id
            );
          }


          // Emit Server-Sent Event to connected clients
          emitPaymentEvent({
            type: status === 'PAID' ? 'PAYMENT_PAID' : (status === 'EXPIRED' ? 'PAYMENT_FAILED' : 'PAYMENT_UPDATED'),
            order: updatedOrder
          });
        }
      }
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

export default router;
