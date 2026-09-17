import { prisma } from "@/lib/prisma";

export class DeliveryRepository {
  async findDeliveryOrders() {
    return prisma.order.findMany({
      where: { type: "delivery" },
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    });
  }

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
    address: string;
    serviceAreaId: string | null;
    type: string;
    items: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    status: string;
    deliveryPerson: string;
    assignedRole: string;
    assignedAt: Date;
    estimatedDeliveryTime: string;
    notes: string | null;
    createdAt: Date;
    pendingAt: Date;
    archived: boolean;
  }) {
    return prisma.order.create({ data });
  }

  async findOrderByIdWithPayments(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
  }

  async updateOrder(orderId: string, data: any) {
    return prisma.order.update({
      where: { id: orderId },
      data,
    });
  }

  async findOrderByIdOrNumber(identifier: string) {
    return prisma.order.findFirst({
      where: {
        OR: [{ id: identifier }, { orderNumber: identifier }],
      },
      include: { payments: true },
    });
  }
}

export const deliveryRepository = new DeliveryRepository();
