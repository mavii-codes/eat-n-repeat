import { prisma } from "@/lib/prisma";

export class AdminCustomersRepository {
  async listCustomers(search: string, page: number, limit: number) {
    const q = search.trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);
    return { rows, total };
  }

  async findCustomerById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, status: true },
    });
  }
}

export const adminCustomersRepository = new AdminCustomersRepository();
