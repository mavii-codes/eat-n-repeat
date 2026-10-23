import crypto from "crypto";
import { menuRepository } from "@/repositories/menu.repository";
import { reviewsRepository } from "@/repositories/reviews.repository";
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
    // Freshness signal for Online → Local menu pull (additive; ignored by
    // older clients).
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toItemResponse(row: {
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
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    categoryId: row.categoryId,
    available: row.available,
    image: row.image ?? "",
    sizes: sanitizeSizes(row.sizes),
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
    // Freshness signal for Online → Local menu pull (additive; ignored by
    // older clients).
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type MenuSizeOption = { name: string; price: number };

// Sizes are stored as JSON; sanitize on the way out so malformed rows can
// never break customer/admin rendering. Prices are absolute per-size prices.
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
  return toCategoryResponse(row);
}

export async function updateMenuCategory(id: string, input: MenuCategoryInput) {
  const row = await menuRepository.updateCategory(id, {
    name: input.name,
    description: input.description ?? "",
  });
  return toCategoryResponse(row);
}

export async function setMenuCategoryArchived(id: string, archived: boolean) {
  const row = await menuRepository.setCategoryArchived(
    id,
    archived,
    archived ? new Date() : null,
  );
  return toCategoryResponse(row);
}

export async function listMenuItems(includeArchived = false, viewerCustomerId?: string) {
  const rows = await menuRepository.findManyItems(includeArchived);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // GLOBAL aggregates: same AVG+COUNT for every viewer (customers A/B,
  // guests, staff) — computed over ALL visible reviews per menu item.
  // Rounding lives here only (backend); the frontend renders as-is.
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
    return {
      ...toItemResponse(row),
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

export async function createMenuItem(input: MenuItemInput) {
  const row = await menuRepository.createItem({
    id: newId("mi"),
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    categoryId: input.categoryId,
    available: input.available ?? true,
    image: input.image ? input.image : null,
    sizes: sanitizeSizes(input.sizes ?? []),
  });
  return toItemResponse(row);
}

export async function updateMenuItem(id: string, input: MenuItemInput) {
  const row = await menuRepository.updateItem(id, {
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    categoryId: input.categoryId,
    available: input.available ?? true,
    image: input.image ? input.image : null,
    sizes: sanitizeSizes(input.sizes ?? []),
  });
  return toItemResponse(row);
}

export async function setMenuItemArchived(id: string, archived: boolean) {
  const row = await menuRepository.setItemArchived(
    id,
    archived,
    archived ? new Date() : null,
  );
  return toItemResponse(row);
}
