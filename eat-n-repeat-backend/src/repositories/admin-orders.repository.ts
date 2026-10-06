import { prisma } from "@/lib/prisma";

export class AdminOrdersRepository {
  async findManyOrders(
    where: Record<string, unknown>,
    options?: { orderBy?: Record<string, string>; include?: Record<string, unknown>; skip?: number; take?: number }
  ) {
    return prisma.order.findMany({
      where,
      orderBy: options?.orderBy ?? { createdAt: "desc" },
      include: options?.include ?? {},
      ...(options?.skip !== undefined ? { skip: options.skip } : {}),
      ...(options?.take !== undefined ? { take: options.take } : {}),
    });
  }

  async countOrders(where: Record<string, unknown>) {
    return prisma.order.count({ where });
  }

  async findOrderByIdentifier(orderIdParam: string) {
    // Exact primary-key match first: deterministic even when a duplicate
    // walk-in twin shares the same order number (twin PK == orderNumber).
    const byId = await prisma.order.findUnique({
      where: { id: orderIdParam },
    });
    if (byId) return byId;
    // Order-number fallback (legacy callers, POS, retry flows): when several
    // rows share the number, prefer the real customer row over a
    // customer-less replay twin so confirmations/payments always land on the
    // existing order instead of its ghost.
    const matches = await prisma.order.findMany({
      where: { orderNumber: orderIdParam },
      orderBy: { createdAt: "asc" },
    });
    return matches.find((o) => o.customerId) ?? matches[0] ?? null;
  }

  async updateOrder(orderId: string, data: Record<string, unknown>) {
    return prisma.order.update({
      where: { id: orderId },
      data,
    });
  }

  async createCustomerNotification(data: {
    id: string;
    customerId: string;
    type: string;
    title: string;
    description: string;
  }) {
    return prisma.customerNotification.create({ data });
  }

  async findPaymentByOrderId(orderId: string) {
    return prisma.payment.findFirst({
      where: { orderId },
    });
  }

  async updatePayment(paymentId: string, data: Record<string, unknown>) {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  async createPayment(data: {
    id: string;
    orderId: string;
    amount: any;
    status: string;
    paymentMethod: string;
  }) {
    return prisma.payment.create({ data });
  }

  async findOpenCashShift(staffId: string) {
    return prisma.cashShift.findFirst({
      where: { staffId, status: "open" },
    });
  }

  async updateCashShift(shiftId: string, data: Record<string, unknown>) {
    return prisma.cashShift.update({
      where: { id: shiftId },
      data,
    });
  }

  async createCashTransaction(data: {
    id: string;
    shiftId: string;
    orderId: string;
    type: string;
    amount: number;
    timestamp: Date;
  }) {
    return prisma.cashTransaction.create({ data });
  }
}

export const adminOrdersRepository = new AdminOrdersRepository();
