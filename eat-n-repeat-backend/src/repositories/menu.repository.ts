import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Menu Categories
// ---------------------------------------------------------------------------

export class MenuRepository {
  async findManyCategories(includeArchived = false) {
    return prisma.menuCategory.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: { name: "asc" },
    });
  }

  async createCategory(data: { id: string; name: string; description: string }) {
    return prisma.menuCategory.create({ data });
  }

  async updateCategory(id: string, data: { name: string; description: string }) {
    return prisma.menuCategory.update({ where: { id }, data });
  }

  async setCategoryArchived(id: string, archived: boolean, archivedAt: Date | null) {
    return prisma.menuCategory.update({
      where: { id },
      data: { archived, archivedAt },
    });
  }

  // ---------------------------------------------------------------------------
  // Menu Items
  // ---------------------------------------------------------------------------

  async findManyItems(includeArchived = false) {
    return prisma.menuItem.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: { name: "asc" },
    });
  }

  async createItem(data: {
    id: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    available: boolean;
    image: string | null;
  }) {
    return prisma.menuItem.create({ data });
  }

  async updateItem(
    id: string,
    data: {
      name: string;
      description: string;
      price: number;
      categoryId: string;
      available: boolean;
      image: string | null;
    },
  ) {
    return prisma.menuItem.update({ where: { id }, data });
  }

  async setItemArchived(id: string, archived: boolean, archivedAt: Date | null) {
    return prisma.menuItem.update({
      where: { id },
      data: { archived, archivedAt },
    });
  }
}

export const menuRepository = new MenuRepository();
