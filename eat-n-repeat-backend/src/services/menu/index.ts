import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { menuRepository } from "@/repositories/menu.repository";
import { reviewsRepository } from "@/repositories/reviews.repository";
import { emitAdminEvent } from "@/lib/sse";
import type { MenuCategoryInput, MenuItemInput } from "@/schema/menu/menu.schema";

function toCategoryResponse(row: {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toItemResponse(
  row: {
    id: string;
    name: string;
    description: string | null;
    price: unknown;
    categoryId: string;
    available: boolean;
    image: string | null;
    sizes: unknown;
    archived: boolean;
    archivedAt: Date | null;
    updatedAt: Date;
    stockItemId?: string | null;
    stockMode?: string | null;
  },
  stockInfo?: {
    quantity?: unknown;
    unit?: string;
    lowStockThreshold?: unknown;
  } | null,
  isAdminOrStaff = false,
) {
  const stockMode = row.stockMode ?? "NONE";
  const isDirect = stockMode === "DIRECT" && !!row.stockItemId;
  const stockQty = stockInfo?.quantity != null ? Number(stockInfo.quantity) : 0;
  const lowThresh = stockInfo?.lowStockThreshold != null ? Number(stockInfo.lowStockThreshold) : 5;
  const isOutOfStock = isDirect ? stockQty <= 0 : false;
  const isLowStock = isDirect && !isOutOfStock ? stockQty <= lowThresh : false;
  const effectiveAvailable = row.available && !isOutOfStock;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    categoryId: row.categoryId,
    available: effectiveAvailable,
    rawAvailable: row.available,
    isOutOfStock,
    isLowStock,
    image: row.image ?? "",
    sizes: sanitizeSizes(row.sizes),
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
    updatedAt: row.updatedAt.toISOString(),
    stockMode,
    stockItemId: row.stockItemId ?? null,
    // Sensitive numeric quantities & thresholds are only sent to staff/admin (D7):
    ...(isAdminOrStaff
      ? {
          stockQuantity: stockInfo?.quantity != null ? Number(stockInfo.quantity) : null,
          stockUnit: stockInfo?.unit ?? null,
          lowStockThreshold: stockInfo?.lowStockThreshold != null ? Number(stockInfo.lowStockThreshold) : null,
        }
      : {}),
  };
}

export type MenuSizeOption = { name: string; price: number };

export function sanitizeSizes(value: unknown): MenuSizeOption[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: MenuSizeOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const name = String((entry as any).name ?? "").trim();
    const price = Number((entry as any).price);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, price });
    if (out.length >= 20) break;
  }
  return out;
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listMenuCategories(includeArchived = false) {
  const rows = await menuRepository.findManyCategories(includeArchived);
  return rows.map(toCategoryResponse);
}

export async function createMenuCategory(input: MenuCategoryInput) {
  const row = await menuRepository.createCategory({
    id: newId("mc"),
    name: input.name,
    description: input.description ?? "",
  });
  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }
  return toCategoryResponse(row);
}

export async function updateMenuCategory(id: string, input: MenuCategoryInput) {
  const row = await menuRepository.updateCategory(id, {
    name: input.name,
    description: input.description ?? "",
  });
  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }
  return toCategoryResponse(row);
}

export async function setMenuCategoryArchived(id: string, archived: boolean) {
  const row = await menuRepository.setCategoryArchived(
    id,
    archived,
    archived ? new Date() : null,
  );
  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }
  return toCategoryResponse(row);
}

export async function listMenuItems(
  includeArchived = false,
  viewerCustomerId?: string,
  isAdminOrStaff = false,
) {
  const rows = await menuRepository.findManyItems(includeArchived);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Fetch linked stock items for stockMode = DIRECT
  const stockItemIds = [
    ...new Set(rows.map((r) => (r as any).stockItemId).filter(Boolean)),
  ] as string[];
  const stockItems =
    stockItemIds.length > 0
      ? await prisma.stockItem.findMany({
          where: { id: { in: stockItemIds } },
          select: { id: true, quantity: true, unit: true, lowStockThreshold: true },
        })
      : [];
  const stockMap = new Map(stockItems.map((s) => [s.id, s]));

  const aggregates = await reviewsRepository.aggregateMany(ids);
  const mine =
    viewerCustomerId && ids.length > 0
      ? await reviewsRepository.findManyVisibleByMenuItemIds(ids).then((found) => {
          const map: Record<string, number> = {};
          for (const f of found) {
            if (f.customerId === viewerCustomerId) map[f.menuItemId] = f.rating;
          }
          return map;
        })
      : {};

  return rows.map((row) => {
    const agg = aggregates[row.id];
    const averageRating = agg ? Math.round(agg.average * 10) / 10 : 0;
    const ratingCount = agg ? agg.count : 0;
    const myRating = mine[row.id] ?? null;
    const stockInfo = (row as any).stockItemId ? stockMap.get((row as any).stockItemId) : null;

    return {
      ...toItemResponse(row as any, stockInfo, isAdminOrStaff),
      averageRating,
      ratingCount,
      myRating,
      hasReviewed: myRating !== null,
    };
  });
}

export async function listArchivedMenuIds() {
  const [items, categories] = await Promise.all([
    menuRepository.findArchivedItemIds(),
    menuRepository.findArchivedCategoryIds(),
  ]);
  return { items, categories };
}

export async function createMenuItem(input: MenuItemInput & { stockMode?: string; stockItemId?: string | null; createStockItem?: any }) {
  const trimmedName = input.name.trim();

  const result = await prisma.$transaction(async (tx) => {
    // Look up menu category to align stock category
    const menuCat = await tx.menuCategory.findUnique({ where: { id: input.categoryId } });
    const catName = menuCat?.name || "General";

    let stockCat = await tx.stockCategory.findFirst({ where: { name: catName } });
    if (!stockCat) {
      stockCat = await tx.stockCategory.create({
        data: { id: newId("sc"), name: catName },
      });
    }

    let finalStockItemId: string | null = null;
    const finalStockMode = "DIRECT";

    if (input.stockItemId) {
      // Verify stock item exists
      const stock = await tx.stockItem.findUnique({
        where: { id: input.stockItemId },
      });
      if (!stock) {
        throw Object.assign(new Error("Selected stock item does not exist."), { status: 400 });
      }
      // Check if already linked
      const alreadyLinked = await tx.menuItem.findFirst({
        where: { stockItemId: input.stockItemId },
      });
      if (alreadyLinked) {
        throw Object.assign(
          new Error(`Stock item "${stock.name}" is already linked to menu item "${alreadyLinked.name}".`),
          { status: 409 },
        );
      }
      // Name sync
      if (stock.name.toLowerCase() !== trimmedName.toLowerCase()) {
        const nameCollision = await tx.stockItem.findFirst({
          where: { name: trimmedName, NOT: { id: stock.id } },
        });
        if (nameCollision) {
          throw Object.assign(
            new Error(`Cannot link: stock item name "${trimmedName}" is already used by another stock item.`),
            { status: 409 },
          );
        }
        await tx.stockItem.update({
          where: { id: stock.id },
          data: { name: trimmedName, archived: false, archivedAt: null },
        });
      } else if (stock.archived) {
        await tx.stockItem.update({
          where: { id: stock.id },
          data: { archived: false, archivedAt: null },
        });
      }
      finalStockItemId = input.stockItemId;
    } else {
      // Auto-create or link StockItem for this menu item
      const existingStock = await tx.stockItem.findFirst({
        where: { name: trimmedName },
      });

      if (existingStock) {
        const alreadyLinked = await tx.menuItem.findFirst({
          where: { stockItemId: existingStock.id },
        });
        if (!alreadyLinked) {
          // Unlinked existing stock item: reuse and unarchive
          await tx.stockItem.update({
            where: { id: existingStock.id },
            data: {
              categoryId: input.createStockItem?.categoryId || stockCat.id,
              unit: input.createStockItem?.unit || existingStock.unit || "pcs",
              lowStockThreshold: input.createStockItem?.lowStockThreshold ?? existingStock.lowStockThreshold ?? 5,
              kind: "menu",
              archived: false,
              archivedAt: null,
            },
          });
          finalStockItemId = existingStock.id;
        } else {
          // Disambiguate name with category
          const disambiguatedName = `${trimmedName} (${catName})`;
          const newStockId = newId("si");
          await tx.stockItem.create({
            data: {
              id: newStockId,
              name: disambiguatedName,
              categoryId: input.createStockItem?.categoryId || stockCat.id,
              unit: input.createStockItem?.unit || "pcs",
              lowStockThreshold: input.createStockItem?.lowStockThreshold ?? 5,
              quantity: 0,
              kind: "menu",
              archived: false,
            },
          });
          finalStockItemId = newStockId;
        }
      } else {
        const newStockId = newId("si");
        await tx.stockItem.create({
          data: {
            id: newStockId,
            name: trimmedName,
            categoryId: input.createStockItem?.categoryId || stockCat.id,
            unit: input.createStockItem?.unit || "pcs",
            lowStockThreshold: input.createStockItem?.lowStockThreshold ?? 5,
            quantity: 0,
            kind: "menu",
            archived: false,
          },
        });
        finalStockItemId = newStockId;
      }
    }

    const row = await tx.menuItem.create({
      data: {
        id: newId("mi"),
        name: trimmedName,
        description: input.description ?? "",
        price: input.price,
        categoryId: input.categoryId,
        available: input.available ?? true,
        image: input.image ? input.image : null,
        sizes: sanitizeSizes(input.sizes ?? []),
        stockMode: finalStockMode,
        stockItemId: finalStockItemId,
      },
    });

    let stockInfo: any = null;
    if (finalStockItemId) {
      stockInfo = await tx.stockItem.findUnique({
        where: { id: finalStockItemId },
        select: { quantity: true, unit: true, lowStockThreshold: true },
      });
    }

    return { row, stockInfo };
  });

  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
    emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }

  return toItemResponse(result.row as any, result.stockInfo, true);
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput & { stockMode?: string; stockItemId?: string | null; createStockItem?: any },
) {
  const trimmedName = input.name.trim();

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.menuItem.findUnique({ where: { id } });
    if (!current) {
      throw Object.assign(new Error("Menu item not found."), { status: 404 });
    }

    // Align stock category with menu category
    const menuCat = await tx.menuCategory.findUnique({ where: { id: input.categoryId } });
    const catName = menuCat?.name || "General";

    let stockCat = await tx.stockCategory.findFirst({ where: { name: catName } });
    if (!stockCat) {
      stockCat = await tx.stockCategory.create({
        data: { id: newId("sc"), name: catName },
      });
    }

    let targetStockMode = "DIRECT";
    let targetStockItemId = current.stockItemId;

    if (input.stockItemId && input.stockItemId !== current.stockItemId) {
      const otherLinked = await tx.menuItem.findFirst({
        where: { stockItemId: input.stockItemId, NOT: { id } },
      });
      if (otherLinked) {
        throw Object.assign(
          new Error(`Stock item is already linked to menu item "${otherLinked.name}".`),
          { status: 409 },
        );
      }
      targetStockItemId = input.stockItemId;
    }

    if (targetStockItemId) {
      const stock = await tx.stockItem.findUnique({ where: { id: targetStockItemId } });
      if (!stock) {
        throw Object.assign(new Error("Selected stock item does not exist."), { status: 400 });
      }
      const dataToUpdate: any = {
        categoryId: stockCat.id,
        archived: false,
        archivedAt: null,
      };
      if (stock.name.toLowerCase() !== trimmedName.toLowerCase()) {
        const collision = await tx.stockItem.findFirst({
          where: { name: trimmedName, NOT: { id: targetStockItemId } },
        });
        if (collision) {
          throw Object.assign(
            new Error(`Cannot sync name: another stock item already has the name "${trimmedName}".`),
            { status: 409 },
          );
        }
        dataToUpdate.name = trimmedName;
      }
      await tx.stockItem.update({
        where: { id: targetStockItemId },
        data: dataToUpdate,
      });
    } else {
      // Current menu item had no stockItemId; auto-create and link
      const existingStock = await tx.stockItem.findFirst({
        where: { name: trimmedName },
      });
      if (existingStock && !existingStock.archived) {
        targetStockItemId = existingStock.id;
      } else {
        const newStockId = newId("si");
        await tx.stockItem.create({
          data: {
            id: newStockId,
            name: trimmedName,
            categoryId: stockCat.id,
            unit: "pcs",
            lowStockThreshold: 5,
            quantity: 0,
            kind: "menu",
            archived: false,
          },
        });
        targetStockItemId = newStockId;
      }
    }

    const row = await tx.menuItem.update({
      where: { id },
      data: {
        name: trimmedName,
        description: input.description ?? "",
        price: input.price,
        categoryId: input.categoryId,
        available: input.available ?? true,
        image: input.image ? input.image : null,
        sizes: sanitizeSizes(input.sizes ?? []),
        stockMode: targetStockMode,
        stockItemId: targetStockItemId,
      },
    });

    let stockInfo: any = null;
    if (targetStockItemId) {
      stockInfo = await tx.stockItem.findUnique({
        where: { id: targetStockItemId },
        select: { quantity: true, unit: true, lowStockThreshold: true },
      });
    }

    return { row, stockInfo };
  });

  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
    emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }

  return toItemResponse(result.row as any, result.stockInfo, true);
}

export async function setMenuItemArchived(id: string, archived: boolean) {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.menuItem.update({
      where: { id },
      data: {
        archived,
        archivedAt: archived ? new Date() : null,
      },
    });
    if (row.stockItemId) {
      await tx.stockItem.update({
        where: { id: row.stockItemId },
        data: {
          archived,
          archivedAt: archived ? new Date() : null,
        },
      });
    }
    return row;
  });

  try {
    emitAdminEvent({ type: "MENU_UPDATED", at: new Date().toISOString() });
    emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }
  return toItemResponse(result as any);
}
