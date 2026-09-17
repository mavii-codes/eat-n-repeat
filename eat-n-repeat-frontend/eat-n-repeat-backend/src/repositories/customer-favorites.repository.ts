import { prisma } from "@/lib/prisma";

export class CustomerFavoritesRepository {
  async findManyByCustomerId(customerId: string) {
    return prisma.customerFavorite.findMany({
      where: { customerId },
      select: { menuItemId: true },
    });
  }

  async upsertFavorite(customerId: string, menuItemId: string) {
    return prisma.customerFavorite.upsert({
      where: {
        customerId_menuItemId: { customerId, menuItemId },
      },
      update: {},
      create: { customerId, menuItemId },
    });
  }

  async deleteFavorite(customerId: string, menuItemId: string) {
    return prisma.customerFavorite.deleteMany({
      where: { customerId, menuItemId },
    });
  }
}

export const customerFavoritesRepository = new CustomerFavoritesRepository();
