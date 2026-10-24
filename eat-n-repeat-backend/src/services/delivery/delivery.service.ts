import { deliveryRepository } from "@/repositories/delivery.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { notifyAllStaff } from "@/services/staff-notifications";
import { releaseRedemptionForOrder } from "@/services/promos/promos.service";
import { releaseStockForOrder } from "@/services/stock/stock-order-sync";
import { emitAdminEvent } from "@/lib/sse";
import crypto from "crypto";

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DLV-${timestamp}-${random}`;
}

/** Payment truth for the Phase 3 cancelled-streak / watch signals. */
function hasPaidPayment(order: any): boolean {
  return Boolean(
    Array.isArray(order?.payments) &&
      order.payments.some(
        (payment: any) => String(payment?.status).toUpperCase() === "PAID",
      ),
  );
}

/**
 * Legacy delivery rows store Order.items as a plain-text summary (e.g.
 * "1x Brown Sugar Boba Milk"), which used to make JSON.parse throw and turn
 * the whole GET /api/delivery/orders response into a 500. Valid JSON arrays
 * pass through; anything else becomes a single-line item in the same
 * { name, quantity, price } shape order consumers already read.
 */
function parseDeliveryItems(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Plain-text legacy summary — fall through to the tolerant shape.
  }
  return [{ name: text, quantity: 1, price: 0 }];
}

export class DeliveryService {
  async getDeliveryOrders() {
    const orders = await deliveryRepository.findDeliveryOrders();
    return orders.map((order: any) => ({
      ...order,
      items: parseDeliveryItems(order.items),
    }));
  }

  async createDeliveryOrder(data: any, customerId?: string) {
    const { customerName, phone, address, serviceAreaId, items, deliveryFee, notes, estimatedDeliveryTime } = data;

    // Validate and fetch addons
    const addonIds = items
      .filter((item: any) => item.type === "addon")
      .map((item: any) => item.id);

    let addons: any[] = [];
    if (addonIds.length > 0) {
      addons = await deliveryRepository.findAddonsByIds(addonIds);
    }

    // Calculate subtotal
    let subtotal = 0;
    const processedItems = items.map((item: any) => {
      if (item.type === "addon") {
        const addon = addons.find((a: any) => a.id === item.id);
        if (addon) {
          subtotal += addon.price * (item.quantity || 1);
          return { ...item, name: addon.name, price: addon.price };
        }
      } else {
        subtotal += (item.price || 0) * (item.quantity || 1);
        return item;
      }
      return item;
    });

    const total = subtotal + (deliveryFee || 0);
    const orderId = crypto.randomUUID();
    const orderNumber = generateOrderNumber();

    const order = await deliveryRepository.createOrder({
      id: orderId,
      orderNumber,
      customerId: customerId || null,
      customerName,
      phone: phone || null,
      address,
      serviceAreaId: serviceAreaId || null,
      type: "delivery",
      items: JSON.stringify(processedItems),
      subtotal,
      deliveryFee: deliveryFee || 0,
      total,
      status: "pending",
      deliveryPerson: "",
      assignedRole: "",
      assignedAt: new Date(),
      estimatedDeliveryTime: estimatedDeliveryTime || "",
      notes: notes || null,
      createdAt: new Date(),
      pendingAt: new Date(),
      archived: false,
    });

    // Notify staff
    await notifyAllStaff(
      "delivery",
      "NEW DELIVERY ORDER",
      `Order #${orderNumber}\nCustomer: ${customerName}\nAmount: ₱${total.toFixed(2)}\nAddress: ${address}`,
      order.id
    );

    // Order event emitted via SSE

    try {
      emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return { ...order, items: processedItems };
  }

  async updateDeliveryOrderStatus(orderId: string, status: string) {
    const order = await deliveryRepository.findOrderByIdWithPayments(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      delivered: ["completed"],
      pending_payment: ["confirmed", "cancelled"],
      awaiting_payment: ["confirmed", "cancelled"],
    };

    if (order.status === "cancelled") {
      throw Object.assign(new Error("Cannot update a cancelled order"), { status: 400 });
    }

    if (order.status === "completed") {
      throw Object.assign(new Error("Cannot update a completed order"), { status: 400 });
    }

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw Object.assign(
        new Error(`Cannot transition from ${order.status} to ${status}`),
        { status: 400 }
      );
    }

    const updatedOrder = await deliveryRepository.updateOrder(orderId, { status });

    // Phase 3 signals: cancel-without-PAID starts a streak; delivered or
    // completed rechecks a "keep watching" flag (both are online orders here).
    if (order.customerId && order.orderMode === "online") {
      if (status === "cancelled" && !hasPaidPayment(order)) {
        await adminFlagsService.maybeFlagCancelledStreak(order.customerId);
      } else if (status === "delivered" || status === "completed") {
        await adminFlagsService.recheckWatchingFlags(order.customerId);
      }
    }

    try {
      emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return updatedOrder;
  }

  async updateDeliveryPerson(orderId: string, deliveryPerson: string) {
    const order = await deliveryRepository.findOrderByIdWithPayments(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(orderId, {
      deliveryPerson,
      assignedAt: new Date(),
    });

    return updatedOrder;
  }

  async reassignDeliveryOrder(orderId: string, personId: string) {
    const order = await deliveryRepository.findOrderByIdOrNumber(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(order.id, {
      deliveryPerson: personId,
      assignedAt: new Date(),
    });

    // Order event emitted via SSE

    return { success: true, order: updatedOrder };
  }

  async cancelDeliveryOrder(orderId: string, cancelledBy: string = "CUSTOMER") {
    const order = await deliveryRepository.findOrderByIdOrNumber(orderId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    if (order.status === "cancelled") {
      throw Object.assign(new Error("Order is already cancelled"), { status: 400 });
    }

    const updatedOrder = await deliveryRepository.updateOrder(order.id, {
      status: "cancelled",
      cancelledBy,
    });

    // Return the promo use for unpaid cancellations. No PAID payment was
    // made on this path (staff handles paid cancellations separately), so
    // only a RESERVED redemption is expected to flip back.
    try {
      await releaseRedemptionForOrder(order.id);
    } catch (promoError) {
      console.error("[delivery] promo release failed:", promoError);
    }
    try {
      await releaseStockForOrder(order.id, "Delivery cancelled", { id: cancelledBy ?? "delivery-service", name: "Delivery" });
    } catch (stockError) {
      console.error("[delivery] stock release failed:", stockError);
    }

    // Phase 3 signal: only a cancellation without a PAID payment feeds the
    // consecutive-cancelled streak (also rechecks any watching flag).
    if (
      order.customerId &&
      order.orderMode === "online" &&
      !hasPaidPayment(order)
    ) {
      await adminFlagsService.maybeFlagCancelledStreak(order.customerId);
    }

    // Order event emitted via SSE

    try {
      emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return updatedOrder;
  }
}
