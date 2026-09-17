import { prisma } from "@/lib/prisma";

export class CustomerOrdersRepository {
  async findOrdersByCustomerId(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const customerOrdersRepository = new CustomerOrdersRepository();
