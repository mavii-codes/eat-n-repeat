import { Prisma } from "@prisma/client";
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
    return prisma.stockCategory.upsert({
      where: { id },
      update: { name },
      create: { id, name },
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

  /**
   * Active stock items only (archived rows are hidden from the dashboard,
   * pickers, lists, and counts). History/movement endpoints query movements
   * directly, so archived items remain queryable there. Pass
   * { includeArchived: true } only for maintenance/admin tooling.
   */
  async findManyItems(opts?: { includeArchived?: boolean }) {
    return prisma.stockItem.findMany({
      where: opts?.includeArchived ? undefined : { archived: false },
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
    kind?: string;
  }) {
    return prisma.stockItem.create({ data });
  }

  async updateItem(
    id: string,
    data: {
      name: string;
      categoryId: string;
      quantity?: number;
      unit: string;
      lowStockThreshold: number;
    },
  ) {
    const { quantity, ...fields } = data;
    return prisma.stockItem.upsert({
      where: { id },
      update: data,
      create: { id, ...fields, quantity: quantity ?? 0 },
    });
  }

  async deleteItem(id: string) {
    return prisma.$transaction(async (tx) => {
      // Lock the item row FIRST (FIFO engine deadlock invariant), then remove
      // its plain-scalar-keyed layers, then the item itself.
      await tx.$queryRaw`SELECT id FROM stock_items WHERE id = ${id} FOR UPDATE`;
      await tx.stockLayer.deleteMany({ where: { stockItemId: id } });
      return tx.stockItem.delete({ where: { id } });
    });
  }

  /** Per-item FIFO layer valuation: costed value + uncosted quantity. */
  async stockLayerValueByItem() {
    const rows = await prisma.$queryRaw<
      Array<{
        stockItemId: string;
        value: Prisma.Decimal | number | string | null;
        uncostedQty: Prisma.Decimal | number | string | null;
      }>
    >`
      SELECT stock_item_id AS stockItemId,
             SUM(remaining * unit_cost) AS value,
             SUM(CASE WHEN unit_cost IS NULL THEN remaining ELSE 0 END) AS uncostedQty
      FROM stock_layers
      GROUP BY stock_item_id
    `;
    const values = new Map<
      string,
      { value: Prisma.Decimal; uncostedQty: Prisma.Decimal }
    >();
    for (const row of rows) {
      values.set(row.stockItemId, {
        value: new Prisma.Decimal((row.value ?? 0) as any),
        uncostedQty: new Prisma.Decimal((row.uncostedQty ?? 0) as any),
      });
    }
    return values;
  }

  /**
   * Layers for the admin list: nearest expiry first, null expiry LAST, then
   * createdAt/id asc. Sorted in JS because MySQL has no NULLS LAST.
   */
  async findLayersForItem(stockItemId: string) {
    const layers = await prisma.stockLayer.findMany({
      where: { stockItemId },
    });
    return layers.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        const byExpiry = a.expiryDate.getTime() - b.expiryDate.getTime();
        if (byExpiry !== 0) return byExpiry;
      } else if (a.expiryDate == null && b.expiryDate != null) {
        return 1;
      } else if (a.expiryDate != null && b.expiryDate == null) {
        return -1;
      }
      const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Layer-based expiring stock: unconsumed layers whose expiry falls on or before
   * maxExpiry. Ordered nearest-expiry first in JS (nullable column).
   */
  async listExpiringLayers(maxExpiry: Date) {
    const layers = await prisma.stockLayer.findMany({
      where: {
        remaining: { gt: 0 },
        expiryDate: { not: null, lte: maxExpiry },
      },
      select: {
        id: true,
        stockItemId: true,
        remaining: true,
        unitCost: true,
        receivedAt: true,
        expiryDate: true,
        createdAt: true,
        sourceRef: true,
      },
    });
    return layers.sort((a, b) => {
      const byExpiry =
        (a.expiryDate ? a.expiryDate.getTime() : 0) -
        (b.expiryDate ? b.expiryDate.getTime() : 0);
      if (byExpiry !== 0) return byExpiry;
      const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
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
