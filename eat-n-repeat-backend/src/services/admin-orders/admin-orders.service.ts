import { adminOrdersRepository } from "@/repositories/admin-orders.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { applyRedemptionForOrder, releaseRedemptionForOrder } from "@/services/promos/promos.service";
import { releaseStockForOrder } from "@/services/stock/stock-order-sync";
import { v4 as uuidv4 } from "uuid";
import type { HistoryQueryInput } from "@/schema/admin-orders/admin-orders.schema";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";

async function resolveSubmittedByUsers(orders: any[]) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const staffIdsToLookup = new Set<string>();
  for (const order of orders) {
    if (order.proofOfDeliverySubmittedBy && uuidRegex.test(order.proofOfDeliverySubmittedBy)) {
      staffIdsToLookup.add(order.proofOfDeliverySubmittedBy);
    }
  }
  if (staffIdsToLookup.size > 0) {
    try {
      const staffUsers = await prisma.user.findMany({
        where: { id: { in: Array.from(staffIdsToLookup) } },
        select: { id: true, name: true },
      });
      const staffMap = new Map(staffUsers.map((u) => [u.id, u.name]));
      for (const order of orders) {
        if (order.proofOfDeliverySubmittedBy && staffMap.has(order.proofOfDeliverySubmittedBy)) {
          order.proofOfDeliverySubmittedBy = staffMap.get(order.proofOfDeliverySubmittedBy);
        }
      }
    } catch (err) {
      console.warn("[admin-orders] Failed to resolve staff names for proof of delivery:", err);
    }
  }
}

export async function getAdminOrders() {
  const orders = await adminOrdersRepository.findManyOrders(
    {},
    {
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    }
  );
  await resolveSubmittedByUsers(orders);
  return orders;
}

/**
 * Staff order-history page: completed/cancelled orders only (records are
 * never deleted or archived by this path), newest-first by DB createdAt,
 * server-side search + status filter + pagination. Only the requested page
 * crosses the wire.
 */
export async function getOrderHistory(query: HistoryQueryInput) {
  const page = Math.max(1, Math.floor(query.page));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit)));
  const search = (query.search ?? "").trim();
  const statuses =
    query.status === "completed"
      ? ["completed"]
      : query.status === "cancelled"
        ? ["cancelled"]
        : ["completed", "cancelled"];

  // Archived records keep existing (never deleted) but are excluded from
  // history listings; they remain viewable via the admin archives page.
  const where: Record<string, unknown> = { status: { in: statuses }, archived: false };
  if (search) {
    (where as any).OR = [
      { orderNumber: { contains: search } },
      { customerName: { contains: search } },
      { items: { contains: search } },
    ];
  }

  const [total, orders] = await Promise.all([
    adminOrdersRepository.countOrders(where),
    adminOrdersRepository.findManyOrders(where, {
      orderBy: { createdAt: "desc" },
      include: { payments: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  // Page beyond the end (concurrent completions shrank the list): refetch
  // the clamped page so callers never render an empty page with data present.
  const finalOrders =
    safePage === page
      ? orders
      : await adminOrdersRepository.findManyOrders(where, {
          orderBy: { createdAt: "desc" },
          include: { payments: true },
          skip: (safePage - 1) * limit,
          take: limit,
        });

  await resolveSubmittedByUsers(finalOrders);

  return {
    orders: finalOrders,
    pagination: { page: safePage, limit, total, totalPages },
  };
}

/**
 * Pick-Up orders carry who collects and when. Appended to customer
 * notifications as `Pick up by: <name> · <time>` (Manila wall clock), the same
 * wording the customer/staff screens use. Legacy Pick-Up rows without these
 * columns fall back to nothing here, leaving the plain Pick-Up message.
 */
function pickupNote(order: any): string {
  // Prisma field is `type`; `orderType` is accepted so this also works if the
  // row is an API-shaped object.
  const orderType = String(order?.type ?? order?.orderType ?? "").toLowerCase();
  if (!order || orderType !== "pickup") return "";

  const name = String(order.pickupName || "").trim();
  const at = order.pickupAt ? new Date(order.pickupAt) : null;
  const time =
    at && !Number.isNaN(at.getTime())
      ? at.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Manila",
        })
      : "";

  if (name && time) return ` Pick up by: ${name} · ${time}`;
  if (name) return ` Pick up by: ${name}`;
  if (time) return ` Pick-up time: ${time}`;
  return "";
}

export async function updateAdminOrderStatus(orderIdParam: string, status: string) {
  const order = await adminOrdersRepository.findOrderByIdentifier(orderIdParam);
  if (!order) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
  }

  if (order.status === "cancelled") {
    throw Object.assign(new Error("Cancelled orders cannot be reopened or changed."), { status: 403 });
  }

  if (order.status === "completed") {
    throw Object.assign(new Error("Completed orders cannot be reopened or changed."), { status: 403 });
  }

  const updatedOrder = await adminOrdersRepository.updateOrder(order.id, { status });

  // Redemption bookkeeping, best-effort (never fails the status change):
  // cancelled unpaid orders give the promo use back; delivered/completed
  // orders confirm any still-RESERVED redemption out of safety.
  try {
    if (status === "cancelled") {
      await releaseRedemptionForOrder(order.id);
      await releaseStockForOrder(order.id, "Admin cancelled order", { id: "admin", name: "Admin" });
    } else if (status === "delivered" || status === "completed") {
      await applyRedemptionForOrder(order.id);
    }
  } catch (promoError) {
    console.error("[admin-orders] promo redemption status sync failed:", promoError);
  }

  // Phase 3 signals for online customer orders: cancellation feeds the
  // cancelled-streak rule; delivered/completed rechecks "keep watching".
  if (order.customerId && order.orderMode === "online") {
    if (status === "cancelled") {
      await adminFlagsService.maybeFlagCancelledStreak(order.customerId);
    } else if (status === "delivered" || status === "completed") {
      await adminFlagsService.recheckWatchingFlags(order.customerId);
    }
  }

  // Notify customer
  const statusMessages: Record<string, string> = {
    confirmed: "Your order has been confirmed!",
    preparing: "Your order is now being prepared.",
    ready: "Your order is ready!",
    delivered: "Your order has been delivered.",
    completed: "Your order is complete. Thank you!",
  };

  const title = `Order #${order.orderNumber} Updated`;
  const description = (statusMessages[status] || `Order status updated to ${status}`) + pickupNote(order);

  // Notify customer (best-effort, never fails the status update:
  // guest/walk-in orders have no customerId, and the notifications FK
  // would reject an empty id with P2003 after the status was saved).
  if (order.customerId) {
    try {
      await adminOrdersRepository.createCustomerNotification({
        id: uuidv4(),
        customerId: order.customerId,
        type: "order_update",
        title,
        description,
      });
    } catch (notifyError) {
      console.error("Order status saved but customer notification failed:", notifyError);
    }
  }

  try {
    emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }

  return updatedOrder;
}

export async function markOrderAsPaid(orderIdParam: string, body: any, userId?: string) {
  const order = await adminOrdersRepository.findOrderByIdentifier(orderIdParam);
  if (!order) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
  }

  const currentStatus = String(order.status ?? "").toLowerCase();
  if (currentStatus === "completed" || currentStatus === "cancelled") {
    throw Object.assign(
      new Error("This order is already completed/cancelled and cannot be marked as paid."),
      { status: 400 },
    );
  }

  const { paymentMethod = "cash", amount } = body;
  const totalAmount = amount || Number(order.total);

  // Check if there's already a paid payment for this order
  const existingPayment = await adminOrdersRepository.findPaymentByOrderId(order.id);
  if (existingPayment && existingPayment.status === "PAID") {
    throw Object.assign(new Error("Order is already paid"), { status: 400 });
  }

  // Create or update payment
  if (existingPayment) {
    await adminOrdersRepository.updatePayment(existingPayment.id, {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod,
    });
  } else {
    await adminOrdersRepository.createPayment({
      id: uuidv4(),
      orderId: order.id,
      amount: totalAmount,
      status: "PAID",
      paymentMethod,
    });
  }

  // Update order status
  await adminOrdersRepository.updateOrder(order.id, { status: "confirmed" });

  // Payment truth confirmed: the redemption matures RESERVED → APPLIED.
  try {
    await applyRedemptionForOrder(order.id);
  } catch (promoError) {
    console.error("[admin-orders] promo apply failed (order is paid):", promoError);
  }

  // Handle cash shift if payment method is cash. The drawer total lives
  // in expectedCash (there is no totalSales column — writing one threw and
  // turned every paid confirmation into a 500 AFTER the payment was saved).
  // Skip when this order already has a shift transaction (e.g. a POS sale
  // recorded at checkout time): one collection => exactly one drawer row.
  if (paymentMethod === "cash" && userId) {
    const openShift = await adminOrdersRepository.findOpenCashShift(userId);
    if (openShift) {
      const existingTx = await adminOrdersRepository.findCashTransactionByOrderId(order.id);
      if (!existingTx) {
        await adminOrdersRepository.createCashTransaction({
          id: uuidv4(),
          shiftId: openShift.id,
          orderId: order.id,
          type: "sale",
          amount: totalAmount,
          timestamp: new Date(),
        });

        await adminOrdersRepository.updateCashShift(openShift.id, {
          expectedCash: { increment: totalAmount },
        });
      }
    }
  }

  // Calculate change if cash
  let change = 0;
  if (paymentMethod === "cash" && body.cashTendered) {
    change = body.cashTendered - totalAmount;
  }

  // Notify customer (walk-in/anonymous orders have no customerId; the FK
  // rejects an empty id with P2003, so skip the notification for those).
  if (order.customerId) {
    try {
      await adminOrdersRepository.createCustomerNotification({
        id: uuidv4(),
        customerId: order.customerId,
        type: "payment",
        title: `Payment Received - Order #${order.orderNumber}`,
        description: `Your payment of ₱${totalAmount.toFixed(2)} has been received.`,
      });
    } catch (notifyError) {
      console.error("Payment saved but customer notification failed:", notifyError);
    }
  }

  // Phase 3 signal: a PAID payment may let a "keep watching" flag auto-dismiss.
  if (order.customerId) {
    await adminFlagsService.recheckWatchingFlags(order.customerId);
  }

  try {
    emitAdminEvent({ type: "PAYMENT_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }

  return { change };
}
