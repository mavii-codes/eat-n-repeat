import { prisma } from "@/lib/prisma";

export class CustomerOrdersRepository {
  async findOrdersByCustomerId(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOrderByIdAndCustomer(orderId: string, customerId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
  }

  async cancelOrder(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled", cancelledBy: "customer", cancelledAt: new Date() },
    });
  }
}

export const customerOrdersRepository = new CustomerOrdersRepository();
