import { prisma } from "@/lib/prisma";

export class CustomerAddressesRepository {
  async findManyByCustomerId(customerId: string) {
    return prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async countByCustomerId(customerId: string) {
    return prisma.customerAddress.count({
      where: { customerId },
    });
  }

  async create(data: {
    id: string;
    customerId: string;
    addressName: string;
    fullAddress: string;
    barangay: string;
    municipality: string;
    landmarks?: string | null;
    deliveryNotes?: string | null;
    isDefault: boolean;
  }) {
    return prisma.customerAddress.create({ data });
  }

  async updateMany(
    where: { id: string; customerId: string },
    data: Record<string, unknown>
  ) {
    const result = await prisma.customerAddress.updateMany({ where, data });
    return result.count;
  }

  async deleteMany(where: { id: string; customerId: string }) {
    const result = await prisma.customerAddress.deleteMany({ where });
    return result.count;
  }

  async findFirst(
    where: Record<string, unknown>
  ) {
    return prisma.customerAddress.findFirst({ where });
  }

  async findFirstRecent(customerId: string) {
    return prisma.customerAddress.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateById(id: string, data: Record<string, unknown>) {
    return prisma.customerAddress.update({ where: { id }, data });
  }

  async clearAllDefaults(customerId: string) {
    return prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });
  }
}

export const customerAddressesRepository = new CustomerAddressesRepository();
