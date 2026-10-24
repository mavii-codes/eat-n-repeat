import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Row shape returned by the FOR UPDATE lock query (physical columns). */
export type LockedStockItemRow = {
  id: string;
  quantity: Prisma.Decimal | number | string;
  name: string;
  unit: string;
  low_stock_threshold: Prisma.Decimal | number | string;
  archived: number | boolean;
};

export class StockMovementsRepository {
  /**
   * Locks the stock item for the duration of the surrounding transaction so
   * concurrent stock-in/adjust writes cannot interleave balances.
   */
  async findItemForUpdate(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<LockedStockItemRow[]>`
      SELECT id, quantity, name, unit, low_stock_threshold, archived
      FROM stock_items
      WHERE id = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async findManyMovements(
    where: Prisma.StockMovementWhereInput,
    options: { skip: number; take: number },
  ) {
    return prisma.stockMovement.findMany({
      where,
      // Timestamp(3) keeps same-second writes distinct; id desc is the stable tie-break.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: options.skip,
      take: options.take,
    });
  }

  async countMovements(where: Prisma.StockMovementWhereInput) {
    return prisma.stockMovement.count({ where });
  }

  async listRecentMovements(limit: number) {
    return prisma.stockMovement.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  /** STOCK_IN movements expiring inside the window, nearest expiry first. */
  async listExpiringStockIns(from: Date, to: Date) {
    return prisma.stockMovement.findMany({
      where: {
        type: "STOCK_IN",
        expiryDate: { gte: from, lte: to },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { stockItemId: true, itemName: true, expiryDate: true },
    });
  }

  /** Top deductions/removals in the window, grouped by item (most used first). */
  async listDeductionUsageSince(since: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ stockItemId: string; itemName: string; used: Prisma.Decimal | number | string }>
    >`
      SELECT stock_item_id AS stockItemId,
             MAX(item_name) AS itemName,
             SUM(quantity_change * -1) AS used
      FROM stock_movements
      WHERE type IN ('ADJUSTMENT_REMOVE', 'SALE_DEDUCTION')
        AND created_at >= ${since}
      GROUP BY stock_item_id
      ORDER BY used DESC
      LIMIT 10
    `;
    return rows.map((row) => ({
      stockItemId: row.stockItemId,
      itemName: row.itemName,
      used: Number(row.used) || 0,
    }));
  }

  /** Latest non-null unit cost per stock item (Phase A fallback for layer-less items). */
  async lastUnitCostPerItem() {
    const rows = await prisma.$queryRaw<
      Array<{ stockItemId: string; unitCost: Prisma.Decimal | number | string }>
    >`
      SELECT sm.stock_item_id AS stockItemId, sm.unit_cost AS unitCost
      FROM stock_movements sm
      WHERE sm.unit_cost IS NOT NULL
        AND sm.id = (
          SELECT sm2.id
          FROM stock_movements sm2
          WHERE sm2.stock_item_id = sm.stock_item_id
            AND sm2.unit_cost IS NOT NULL
          ORDER BY sm2.created_at DESC, sm2.id DESC
          LIMIT 1
        )
    `;
    const costs = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      if (row.unitCost == null) continue;
      costs.set(row.stockItemId, new Prisma.Decimal(row.unitCost as any));
    }
    return costs;
  }

  /** Latest non-null unit cost for one item, inside the caller's transaction. */
  async lastUnitCostForItem(
    tx: Prisma.TransactionClient,
    stockItemId: string,
  ): Promise<Prisma.Decimal | null> {
    const rows = await tx.$queryRaw<
      Array<{ unitCost: Prisma.Decimal | number | string }>
    >`
      SELECT sm.unit_cost AS unitCost
      FROM stock_movements sm
      WHERE sm.stock_item_id = ${stockItemId}
        AND sm.unit_cost IS NOT NULL
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT 1
    `;
    const row = rows[0];
    return row?.unitCost == null ? null : new Prisma.Decimal(row.unitCost as any);
  }
}

export const stockMovementsRepository = new StockMovementsRepository();
