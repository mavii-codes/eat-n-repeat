import { prisma } from "@/lib/prisma";

export async function runStockConsistencyCheck() {
  const stockItems = await prisma.stockItem.findMany();
  const stockItemMap = new Map(stockItems.map((s) => [s.id, s]));

  // Check layers vs quantity
  const layerSums = await prisma.$queryRawUnsafe<Array<{ stock_item_id: string; total_remaining: string }>>(
    `SELECT stock_item_id, SUM(remaining) as total_remaining FROM stock_layers GROUP BY stock_item_id`,
  );
  const layerSumMap = new Map(layerSums.map((l) => [l.stock_item_id, Number(l.total_remaining)]));

  const layerQuantityMismatches = [];
  for (const item of stockItems) {
    const layerSum = layerSumMap.get(item.id) ?? 0;
    const itemQty = Number(item.quantity);
    if (Math.abs(layerSum - itemQty) > 0.005) {
      layerQuantityMismatches.push({
        stockItemId: item.id,
        name: item.name,
        stockQuantity: itemQty,
        layerSum,
        diff: Number((itemQty - layerSum).toFixed(2)),
      });
    }
  }

  // Check orphan layers
  const orphanLayers = layerSums
    .filter((l) => !stockItemMap.has(l.stock_item_id))
    .map((l) => ({
      stockItemId: l.stock_item_id,
      totalRemaining: Number(l.total_remaining),
    }));

  // Check linked menu items
  const linkedMenuItems = await prisma.menuItem.findMany({
    where: { stockItemId: { not: null } },
    select: { id: true, name: true, stockItemId: true, stockMode: true, categoryId: true },
  });

  const brokenMenuLinks = [];
  const nameMismatches = [];
  for (const menu of linkedMenuItems) {
    const stock = stockItemMap.get(menu.stockItemId!);
    if (!stock) {
      brokenMenuLinks.push({
        menuItemId: menu.id,
        menuItemName: menu.name,
        stockItemId: menu.stockItemId,
      });
    } else if (stock.name.toLowerCase() !== menu.name.trim().toLowerCase()) {
      nameMismatches.push({
        menuItemId: menu.id,
        menuItemName: menu.name,
        stockItemId: stock.id,
        stockItemName: stock.name,
      });
    }
  }

  const healthy =
    layerQuantityMismatches.length === 0 &&
    brokenMenuLinks.length === 0 &&
    nameMismatches.length === 0;

  return {
    healthy,
    checkedAt: new Date().toISOString(),
    totalStockItems: stockItems.length,
    totalTrackedMenuItems: linkedMenuItems.length,
    layerQuantityMismatches,
    orphanLayers,
    brokenMenuLinks,
    nameMismatches,
  };
}
