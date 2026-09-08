import { prisma } from "@/lib/prisma";

export class PaymentsRepository {
  async findAddonsByIds(addonIds: string[]) {
    return prisma.addon.findMany({
      where: { id: { in: addonIds } },
      select: { id: true, name: true, price: true },
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
    return prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdParam }, { orderNumber: orderIdParam }],
      },
    });
  }

  async updateOrderStatus(id: string, status: string) {
    return prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}

export const paymentsRepository = new PaymentsRepository();
