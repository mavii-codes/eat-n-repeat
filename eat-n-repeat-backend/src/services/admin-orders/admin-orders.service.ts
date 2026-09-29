import { adminOrdersRepository } from "@/repositories/admin-orders.repository";
import { v4 as uuidv4 } from "uuid";
import type { HistoryQueryInput } from "@/schema/admin-orders/admin-orders.schema";

export async function getAdminOrders() {
  return adminOrdersRepository.findManyOrders(
    {},
    {
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    }
  );
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

  const where: Record<string, unknown> = { status: { in: statuses } };
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

  return {
    orders: finalOrders,
    pagination: { page: safePage, limit, total, totalPages },
  };
}

export async function updateAdminOrderStatus(orderIdParam: string, status: string) {
  const order = await adminOrdersRepository.findOrderByIdentifier(orderIdParam);
  if (!order) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
  }

  if (order.status === "cancelled") {
    throw Object.assign(new Error("Cannot update a cancelled order"), { status: 403 });
  }

  const updatedOrder = await adminOrdersRepository.updateOrder(order.id, { status });

  // Notify customer
  const statusMessages: Record<string, string> = {
    confirmed: "Your order has been confirmed!",
    preparing: "Your order is now being prepared.",
    ready: "Your order is ready!",
    delivered: "Your order has been delivered.",
    completed: "Your order is complete. Thank you!",
  };

  const title = `Order #${order.orderNumber} Updated`;
  const description = statusMessages[status] || `Order status updated to ${status}`;

  await adminOrdersRepository.createCustomerNotification({
    id: uuidv4(),
    customerId: order.customerId || "",
    type: "order_update",
    title,
    description,
  });

  return updatedOrder;
}

export async function markOrderAsPaid(orderIdParam: string, body: any, userId?: string) {
  const order = await adminOrdersRepository.findOrderByIdentifier(orderIdParam);
  if (!order) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
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

  // Handle cash shift if payment method is cash
  if (paymentMethod === "cash" && userId) {
    const openShift = await adminOrdersRepository.findOpenCashShift(userId);
    if (openShift) {
      await adminOrdersRepository.createCashTransaction({
        id: uuidv4(),
        shiftId: openShift.id,
        orderId: order.id,
        type: "sale",
        amount: totalAmount,
        timestamp: new Date(),
      });

      await adminOrdersRepository.updateCashShift(openShift.id, {
        totalSales: { increment: totalAmount },
      });
    }
  }

  // Calculate change if cash
  let change = 0;
  if (paymentMethod === "cash" && body.cashTendered) {
    change = body.cashTendered - totalAmount;
  }

  // Notify customer
  await adminOrdersRepository.createCustomerNotification({
    id: uuidv4(),
    customerId: order.customerId || "",
    type: "payment",
    title: `Payment Received - Order #${order.orderNumber}`,
    description: `Your payment of ₱${totalAmount.toFixed(2)} has been received.`,
  });

  return { change };
}
