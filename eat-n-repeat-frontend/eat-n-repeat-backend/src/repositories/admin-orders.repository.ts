import { prisma } from "@/lib/prisma";

export class AdminOrdersRepository {
  async findManyOrders(where: Record<string, unknown>, options?: { orderBy?: Record<string, string>; include?: Record<string, unknown> }) {
    return prisma.order.findMany({
      where,
      orderBy: options?.orderBy ?? { createdAt: "desc" },
      include: options?.include ?? {},
    });
  }

  async findOrderByIdentifier(orderIdParam: string) {
    return prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdParam }, { orderNumber: orderIdParam }],
      },
    });
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
