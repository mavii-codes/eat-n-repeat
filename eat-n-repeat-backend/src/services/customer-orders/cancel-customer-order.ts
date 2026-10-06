import { customerOrdersRepository } from "@/repositories/customer-orders.repository";

// Customer-initiated cancellation. Ownership is enforced in the lookup
// itself (id AND customerId), so one customer can never cancel another's
// order — unknown/foreign ids uniformly 404. Only not-yet-confirmed states
// may cancel; confirmed/preparing/ready/delivered/completed rows are
// rejected. Payments are intentionally untouched (no auto-refund path).
const CANCELLABLE_STATUSES = ["pending", "pending_payment", "awaiting_payment"];

export class CancelCustomerOrderService {
  async execute(orderId: string, customerId: string) {
    const order = await customerOrdersRepository.findOrderByIdAndCustomer(orderId, customerId);
    if (!order) {
      throw Object.assign(new Error("Order not found"), { status: 404 });
    }
    if (order.status === "cancelled") {
      throw Object.assign(new Error("Order is already cancelled"), { status: 400 });
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw Object.assign(
        new Error("Only pending orders can be cancelled. Please ask staff for help with this order."),
        { status: 400 }
      );
    }
    // Paid orders must never be customer-cancelled: payment truth lives in
    // the payments table, and cancelling here would leave a PAID row on a
    // cancelled order. Staff handles paid cancellations/refunds manually.
    const latestPayment = (order as any).payments?.[0] ?? null;
    if (latestPayment && String(latestPayment.status).toUpperCase() === "PAID") {
      throw Object.assign(
        new Error("This order is already paid and cannot be cancelled online. Please ask staff for help."),
        { status: 400 }
      );
    }
    return customerOrdersRepository.cancelOrder(order.id);
  }
}

export const cancelCustomerOrderService = new CancelCustomerOrderService();
