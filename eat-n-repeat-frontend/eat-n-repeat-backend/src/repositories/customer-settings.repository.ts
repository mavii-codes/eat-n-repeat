import { prisma } from "@/lib/prisma";

export class CustomerSettingsRepository {
  async findCustomerById(customerId: string) {
    return prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        avatarUrl: true,
        notificationPreferences: true,
        createdAt: true,
      },
    });
  }

  async findCustomerPasswordHash(customerId: string) {
    return prisma.customer.findUnique({
      where: { id: customerId },
      select: { passwordHash: true },
    });
  }

  async updateCustomer(customerId: string, data: Record<string, unknown>) {
    return prisma.customer.update({
      where: { id: customerId },
      data,
    });
  }

  async updateCustomerPassword(customerId: string, passwordHash: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash },
    });
  }

  async deleteCustomer(customerId: string) {
    return prisma.customer.delete({
      where: { id: customerId },
    });
  }
}

export const customerSettingsRepository = new CustomerSettingsRepository();
