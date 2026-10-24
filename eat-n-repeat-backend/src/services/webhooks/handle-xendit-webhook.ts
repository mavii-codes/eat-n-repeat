import { webhooksRepository } from "@/repositories/webhooks.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { notifyAllStaff } from "@/services/staff-notifications";
import { applyRedemptionForOrder, releaseRedemptionForOrder } from "@/services/promos/promos.service";
import { releaseStockForOrder } from "@/services/stock/stock-order-sync";
import { emitAdminEvent, emitPaymentEvent } from "@/lib/sse";

export class HandleXenditWebhookService {
  async execute(event: any) {
    if (!event || !event.external_id) {
      return null;
    }

    const referenceId = event.external_id;
    const status = event.status; // e.g. PAID, EXPIRED

    // Find the payment by reference id (external_id) or the invoice id.
    const payment = await webhooksRepository.findPaymentByXenditReference(
      referenceId,
      typeof event.id === "string" ? event.id : undefined,
    );

    if (!payment) {
      return null;
    }

    // Idempotency: already settled for this invoice — acknowledge, skip writes.
    if (payment.status === "PAID" && event.id && payment.xenditInvoiceId === event.id) {
      return await webhooksRepository.findOrderById(payment.orderId);
    }

    // Fetch current order status first to check if it was cancelled
    const orderData = await webhooksRepository.findOrderStatusAndType(payment.orderId);
    const wasCancelled = orderData && orderData.status === "cancelled";
    const orderType = orderData ? orderData.type : "delivery";

    // Amount validation: the webhook amount must match the order total.
    // A mismatch is acknowledged WITHOUT state changes (no retry storm).
    if (event.amount !== undefined && event.amount !== null && orderData) {
      const webhookAmount = Number(event.amount);
      const orderTotal = Number((orderData as any).total);
      if (
        Number.isFinite(webhookAmount) &&
        Number.isFinite(orderTotal) &&
        Math.abs(webhookAmount - orderTotal) > 0.01
      ) {
        console.error(
          `[webhooks] Amount mismatch for order ${payment.orderId}: webhook=${webhookAmount} order=${orderTotal}. Ignored.`
        );
        return null;
      }
    }

    // Update payment status
    await webhooksRepository.updatePaymentStatus(
      payment.id,
      status,
      status === "PAID" ? new Date() : null,
    );

    // Update order status if paid
    if (status === "PAID") {
      await webhooksRepository.updateOrderStatus(payment.orderId, "confirmed");
      // Promo redemption matured: RESERVED → APPLIED (idempotent via status).
      try {
        await applyRedemptionForOrder(payment.orderId);
      } catch (promoError) {
        console.error("[webhooks] promo apply failed:", promoError);
      }
    } else if (status === "EXPIRED" || status === "FAILED") {
      const revertStatus = orderType === "dine-in" ? "awaiting_payment" : "pending_payment";
      await webhooksRepository.updateOrderStatus(payment.orderId, revertStatus);
      // Invoice died: give the promo use back and release stock
      try {
        await releaseRedemptionForOrder(payment.orderId);
      } catch (promoError) {
        console.error("[webhooks] promo release failed:", promoError);
      }
      try {
        await releaseStockForOrder(payment.orderId, `Payment ${status.toLowerCase()}`, { id: "xendit-webhook", name: "Xendit Webhook" });
      } catch (stockError) {
        console.error("[webhooks] stock release failed:", stockError);
      }
    }

    // Fetch updated order info to broadcast
    const updatedOrder = await webhooksRepository.findOrderById(payment.orderId);

    if (updatedOrder) {
      // Phase 3 signal: a PAID payment rechecks any "keep watching" flag.
      if (status === "PAID" && updatedOrder.customerId) {
        await adminFlagsService.recheckWatchingFlags(updatedOrder.customerId);
      }

      if (status === "PAID") {
        // Full notification for GCash-paid orders
        const typeLabel =
          updatedOrder.type === "dine-in" ? "Dine-in" : updatedOrder.type === "pickup" ? "Pickup" : "Delivery";

        // Highlight if it's a late payment after expiry
        const titlePrefix = wasCancelled ? "LATE PAYMENT RECEIVED" : `NEW ${typeLabel.toUpperCase()} ORDER`;

        let paidMessage = `Order #${updatedOrder.orderNumber} — Payment Received!\nCustomer: ${updatedOrder.customerName}\nAmount: ₱${Number(updatedOrder.total).toFixed(2)}\nType: ${typeLabel}`;

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

        await notifyAllStaff(updatedOrder.type || "payment", titlePrefix, paidMessage, updatedOrder.id);
      }

      // Emit Server-Sent Event to connected clients. Payload is deliberately
      // limited to routing fields (no customer PII, items, or amounts).
      emitPaymentEvent({
        type: status === "PAID" ? "PAYMENT_PAID" : status === "EXPIRED" ? "PAYMENT_FAILED" : "PAYMENT_UPDATED",
        at: new Date().toISOString(),
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        paymentStatus: status ?? null,
      });

      try {
        emitAdminEvent({ type: "PAYMENT_UPDATED", at: new Date().toISOString() });
      } catch {
        /* event must never break the write */
      }
    }

    return updatedOrder;
  }
}

export const handleXenditWebhookService = new HandleXenditWebhookService();
