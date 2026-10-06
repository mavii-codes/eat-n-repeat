import { prisma } from "@/lib/prisma";

export class PaymentsRepository {
  async findAddonsByIds(addonIds: string[]) {
    return prisma.addon.findMany({
      where: { id: { in: addonIds } },
      select: { id: true, name: true, price: true, available: true },
    });
  }

  async createOrder(data: {
    id: string;
    orderNumber: string;
    customerId: string | null;
    customerName: string;
    phone: string | null;
    address: string | null;
    serviceAreaId: string | null;
    type: string;
    items: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    status: string;
    notes: string | null;
    orderMode?: string;
  }) {
    return prisma.order.create({
      data: {
        ...data,
        orderMode: data.orderMode ?? "online",
      },
    });
  }

  async createPayment(data: {
    id: string;
    orderId: string;
    paymentMethod: string;
    xenditInvoiceId?: string;
    xenditReference?: string;
    amount: number;
    status: string;
  }) {
    return prisma.payment.create({
      data: {
        id: data.id,
        orderId: data.orderId,
        paymentMethod: data.paymentMethod,
        xenditInvoiceId: data.xenditInvoiceId,
        xenditReference: data.xenditReference,
        amount: data.amount,
        status: data.status,
      },
    });
  }

  async updatePayment(
    id: string,
    data: Partial<{
      paymentMethod: string;
      xenditInvoiceId: string;
      xenditReference: string;
      amount: number;
      status: string;
    }>,
  ) {
    return prisma.payment.update({
      where: { id },
      data,
    });
  }

  async findPaymentByOrderIdentifier(orderIdParam: string) {
    return prisma.payment.findFirst({
      where: {
        OR: [{ orderId: orderIdParam }, { order: { orderNumber: orderIdParam } }],
      },
      orderBy: { createdAt: "desc" },
      include: { order: true },
    });
  }

  async findOrderByIdentifier(orderIdParam: string) {
    // Exact primary-key match first: deterministic even when a duplicate
    // walk-in twin shares the same order number (twin PK == orderNumber).
    const byId = await prisma.order.findUnique({
      where: { id: orderIdParam },
    });
    if (byId) return byId;
    // Order-number fallback (retry/payment flows): when several rows share
    // the number, prefer the real customer row over a customer-less replay
    // twin so payments attach to the existing order instead of its ghost.
    const matches = await prisma.order.findMany({
      where: { orderNumber: orderIdParam },
      orderBy: { createdAt: "asc" },
    });
    return matches.find((o) => o.customerId) ?? matches[0] ?? null;
  }

  async updateOrderStatus(id: string, status: string) {
    return prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}

export const paymentsRepository = new PaymentsRepository();
