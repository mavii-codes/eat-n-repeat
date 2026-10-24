import { Prisma } from "@prisma/client";
import { stockRepository } from "@/repositories/stock.repository";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import { getManilaDateString } from "@/schema/stock/movements.schema";
import { serializeMovement } from "./movement-helpers";

export const EXPIRY_WINDOW_DAYS = 7;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_CAP = 20;
const EXPIRING_LIST_CAP = 10;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export class StockDashboardService {
  async execute() {
    const now = new Date();
    const todayManilaStr = getManilaDateString(now);
    const [y, m, d] = todayManilaStr.split("-").map(Number);
    const endWindowDate = new Date(Date.UTC(y, m - 1, d + EXPIRY_WINDOW_DAYS));
    const endWindowStr = `${endWindowDate.getUTCFullYear()}-${pad2(endWindowDate.getUTCMonth() + 1)}-${pad2(endWindowDate.getUTCDate())}`;
    const endWindowTime = new Date(`${endWindowStr}T23:59:59.999+08:00`);

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
      stockRepository.listExpiringLayers(endWindowTime),
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

    // Exclude archived items from active alerts
    const activeItems = items.filter((item) => !(item as any).archived);

    const lowStockRows = activeItems
      .filter((item) => {
        const quantity = Number(item.quantity);
        return quantity > 0 && quantity <= Number(item.lowStockThreshold);
      })
      .map(compact)
      .sort((a, b) => a.quantity - b.quantity);

    const outOfStockRows = activeItems
      .filter((item) => Number(item.quantity) <= 0)
      .map(compact)
      .sort((a, b) => a.quantity - b.quantity);

    const itemById = new Map(activeItems.map((item) => [item.id, item]));

    // Batch-level expiring rows: batches with remaining > 0 and expiryDate <= endWindowTime
    // Sorted soonest first (already done by repository: earliest expiry first, so expired batches are at top).
    // Distinct items with at least one batch expiring in [todayManila, todayManila + 7 days].
    const distinctExpiringItemIds = new Set<string>();
    let alreadyExpiredBatchesCount = 0;
    const qualifyingExpiringBatches: Array<{
      id: string;
      stockItemId: string;
      itemName: string;
      quantityRemaining: number;
      unit: string;
      expiryDate: string;
      receivedAt: string;
    }> = [];

    for (const layer of expiringLayers) {
      if (!layer.expiryDate) continue;
      const item = itemById.get(layer.stockItemId);
      if (!item) continue; // Excludes archived or non-existent items
      const rem = Number(layer.remaining);
      if (rem <= 0) continue; // Excludes zero remaining batches

      const layerManilaStr = getManilaDateString(layer.expiryDate);
      const isExpired = layerManilaStr < todayManilaStr;
      const isExpiringWithin7Days =
        layerManilaStr >= todayManilaStr && layerManilaStr <= endWindowStr;

      if (isExpired) {
        alreadyExpiredBatchesCount += 1;
      } else if (isExpiringWithin7Days) {
        distinctExpiringItemIds.add(layer.stockItemId);
      }

      if (isExpired || isExpiringWithin7Days) {
        qualifyingExpiringBatches.push({
          id: layer.id,
          stockItemId: layer.stockItemId,
          itemName: item.name,
          quantityRemaining: rem,
          unit: item.unit,
          expiryDate: layer.expiryDate.toISOString(),
          receivedAt: (layer.receivedAt ?? layer.createdAt).toISOString(),
        });
      }
    }

    return {
      cards: {
        totalStockValue: totalStockValue.toDecimalPlaces(2).toNumber(),
        valueIsEstimate: itemsWithoutCost > 0,
        itemsWithoutCost,
        lowStockCount: lowStockRows.length,
        outOfStockCount: outOfStockRows.length,
        expiringSoonCount: distinctExpiringItemIds.size,
        alreadyExpiredCount: alreadyExpiredBatchesCount,
      },
      lists: {
        lowStockItems: lowStockRows.slice(0, LIST_CAP),
        outOfStockItems: outOfStockRows.slice(0, LIST_CAP),
        expiringSoon: qualifyingExpiringBatches.slice(0, EXPIRING_LIST_CAP),
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
