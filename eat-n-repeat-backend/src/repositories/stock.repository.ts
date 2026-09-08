import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Stock Categories
// ---------------------------------------------------------------------------

export class StockRepository {
  async findManyCategories() {
    return prisma.stockCategory.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createCategory(data: { id: string; name: string }) {
    return prisma.stockCategory.create({ data });
  }

  async updateCategory(id: string, name: string) {
    return prisma.stockCategory.update({
      where: { id },
      data: { name },
    });
  }

  async deleteCategory(id: string) {
    return prisma.stockCategory.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // Stock Items
  // ---------------------------------------------------------------------------

  async findManyItems() {
    return prisma.stockItem.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createItem(data: {
    id: string;
    name: string;
    categoryId: string;
    quantity: number;
    unit: string;
    lowStockThreshold: number;
  }) {
    return prisma.stockItem.create({ data });
  }

  async updateItem(
    id: string,
    data: {
      name: string;
      categoryId: string;
      quantity: number;
      unit: string;
      lowStockThreshold: number;
    },
  ) {
    return prisma.stockItem.update({
      where: { id },
      data,
    });
  }

  async deleteItem(id: string) {
    return prisma.stockItem.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // Stock Requests
  // ---------------------------------------------------------------------------

  async findManyRequests() {
    return prisma.stockRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findFirstPendingRequest(ingredientId: string) {
    return prisma.stockRequest.findFirst({
      where: { ingredientId, status: "Pending" },
    });
  }

  async createRequest(data: {
    id: string;
    staffId: string;
    staffName: string;
    ingredientId: string;
    ingredientName: string;
    currentQuantity: number;
    unit: string;
    threshold: number;
    status: string;
    message: string | null;
    adminNote: null;
    createdAt: Date;
  }) {
    return prisma.stockRequest.create({ data });
  }

  async updateRequest(
    id: string,
    data: {
      status: string;
      adminNote: string | null;
    },
  ) {
    return prisma.stockRequest.update({
      where: { id },
      data,
    });
  }
}

export const stockRepository = new StockRepository();
