import { Prisma } from "@prisma/client";
import { stockRepository } from "@/repositories/stock.repository";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import { serializeMovement } from "./movement-helpers";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_CAP = 20;
const EXPIRING_LIST_CAP = 10;

export class StockDashboardService {
  async execute() {
    const now = new Date();
    const [
      items,
      layerValues,
      lastUnitCosts,
      recentMovements,
      deductionUsage,
      expiringLayers,
    ] = await Promise.all([
      stockRepository.findManyItems(),
      stockRepository.stockLayerValueByItem(),
      stockMovementsRepository.lastUnitCostPerItem(),
      stockMovementsRepository.listRecentMovements(10),
      stockMovementsRepository.listDeductionUsageSince(new Date(Date.now() - WEEK_MS)),
      stockRepository.listExpiringLayers(now, new Date(now.getTime() + WEEK_MS)),
    ]);

    let totalStockValue = new Prisma.Decimal(0);
    let itemsWithoutCost = 0;
    for (const item of items) {
      const layers = layerValues.get(item.id);
      if (layers) {
        totalStockValue = totalStockValue.plus(layers.value);
        if (layers.uncostedQty.greaterThan(0)) itemsWithoutCost += 1;
        continue;
      }

      // Layer-less fallback (kept permanently): Phase A estimate for items
      // that have no Phase-B layers yet. No cost data contributes 0 and marks
      // the dashboard value as an estimate.
      const unitCost = lastUnitCosts.get(item.id);
      if (unitCost == null) {
        itemsWithoutCost += 1;
        continue;
      }
      totalStockValue = totalStockValue.plus(unitCost.mul(item.quantity));
    }

    const compact = (item: (typeof items)[number]) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      lowStockThreshold: Number(item.lowStockThreshold),
    });

    const lowStockRows = items
      .filter((item) => {
        const quantity = Number(item.quantity);
        return quantity > 0 && quantity <= Number(item.lowStockThreshold);
      })
      .map(compact)
      .sort((a, b) => a.quantity - b.quantity);

    const outOfStockRows = items
      .filter((item) => Number(item.quantity) <= 0)
      .map(compact)
      .sort((a, b) => a.quantity - b.quantity);

    const itemById = new Map(items.map((item) => [item.id, item]));

    // One row per distinct item, using its earliest qualifying layer expiry
    // (the repository query is already ordered nearest-first; comparing again
    // keeps the result correct on its own). Items at zero or below are
    // excluded — nothing left to expire.
    const expiringByItem = new Map<
      string,
      { id: string; name: string; quantity: number; expiryDate: string }
    >();
    for (const layer of expiringLayers) {
      if (!layer.expiryDate) continue;
      const item = itemById.get(layer.stockItemId);
      if (!item || Number(item.quantity) <= 0) continue;

      const expiryDate = layer.expiryDate.toISOString();
      const existing = expiringByItem.get(layer.stockItemId);
      if (existing && existing.expiryDate <= expiryDate) continue;

      expiringByItem.set(layer.stockItemId, {
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        expiryDate,
      });
    }

    const expiringSoonRows = [...expiringByItem.values()].sort((a, b) =>
      a.expiryDate.localeCompare(b.expiryDate),
    );

    return {
      cards: {
        totalStockValue: totalStockValue.toDecimalPlaces(2).toNumber(),
        valueIsEstimate: itemsWithoutCost > 0,
        itemsWithoutCost,
        lowStockCount: lowStockRows.length,
        outOfStockCount: outOfStockRows.length,
        expiringSoonCount: expiringSoonRows.length,
      },
      lists: {
        lowStockItems: lowStockRows.slice(0, LIST_CAP),
        outOfStockItems: outOfStockRows.slice(0, LIST_CAP),
        expiringSoon: expiringSoonRows.slice(0, EXPIRING_LIST_CAP),
        recentMovements: recentMovements.map(serializeMovement),
        mostUsedThisWeek: deductionUsage.map((row) => ({
          stockItemId: row.stockItemId,
          itemName: row.itemName,
          unit: itemById.get(row.stockItemId)?.unit ?? "",
          used: row.used,
        })),
      },
    };
  }
}

export const stockDashboardService = new StockDashboardService();
