import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Ensures all active menu items have a corresponding StockItem in inventory.
 * If a menu item is untracked (stockMode === 'NONE' or stockItemId is null),
 * this automatically finds or creates a StockCategory and StockItem,
 * and links the MenuItem with stockMode: 'DIRECT'.
 */
export async function syncAllMenuItemsToStock() {
  const menuItems = await prisma.menuItem.findMany({
    where: { archived: false },
    include: { category: true },
  });

  const existingStockItems = await prisma.stockItem.findMany({
    where: { archived: false },
  });
  const stockById = new Map(existingStockItems.map((s) => [s.id, s]));
  const stockByName = new Map(existingStockItems.map((s) => [s.name.trim().toLowerCase(), s]));

  const stockCategories = await prisma.stockCategory.findMany();
  const stockCatByName = new Map(stockCategories.map((c) => [c.name.trim().toLowerCase(), c]));

  let createdCount = 0;
  let linkedCount = 0;

  for (const item of menuItems) {
    const trimmedName = item.name.trim();
    const catName = item.category?.name || "General";
    const catKey = catName.trim().toLowerCase();

    // 1. Ensure stock category exists
    let stockCat = stockCatByName.get(catKey);
    if (!stockCat) {
      stockCat = await prisma.stockCategory.create({
        data: {
          id: newId("sc"),
          name: catName,
        },
      });
      stockCatByName.set(catKey, stockCat);
    }

    // 2. Check if already properly linked
    if (item.stockItemId && item.stockMode === "DIRECT") {
      const existingStock = stockById.get(item.stockItemId);
      if (existingStock) {
        continue;
      }
    }

    // 3. Find or create matching stock item
    const nameKey = trimmedName.toLowerCase();
    let targetStockItem = stockByName.get(nameKey);

    if (targetStockItem) {
      const otherMenu = await prisma.menuItem.findFirst({
        where: {
          stockItemId: targetStockItem.id,
          NOT: { id: item.id },
        },
      });
      if (otherMenu) {
        // Disambiguate name with category
        const disambiguated = `${trimmedName} (${catName})`;
        const disambiguatedKey = disambiguated.toLowerCase();
        let disambiguatedStock = stockByName.get(disambiguatedKey);
        if (!disambiguatedStock) {
          disambiguatedStock = await prisma.stockItem.create({
            data: {
              id: newId("si"),
              name: disambiguated,
              categoryId: stockCat.id,
              quantity: 0,
              unit: "pcs",
              lowStockThreshold: 5,
              kind: "menu",
              archived: false,
            },
          });
          stockByName.set(disambiguatedKey, disambiguatedStock);
          stockById.set(disambiguatedStock.id, disambiguatedStock);
          createdCount++;
        }
        targetStockItem = disambiguatedStock;
      }
    } else {
      targetStockItem = await prisma.stockItem.create({
        data: {
          id: newId("si"),
          name: trimmedName,
          categoryId: stockCat.id,
          quantity: 0,
          unit: "pcs",
          lowStockThreshold: 5,
          kind: "menu",
          archived: false,
        },
      });
      stockByName.set(nameKey, targetStockItem);
      stockById.set(targetStockItem.id, targetStockItem);
      createdCount++;
    }

    // 4. Link the menu item
    await prisma.menuItem.update({
      where: { id: item.id },
      data: {
        stockItemId: targetStockItem.id,
        stockMode: "DIRECT",
      },
    });
    linkedCount++;
  }

  if (createdCount > 0 || linkedCount > 0) {
    try {
      emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
      emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }
  }

  return {
    success: true,
    totalMenuItems: menuItems.length,
    createdStockItems: createdCount,
    linkedMenuItems: linkedCount,
  };
}
