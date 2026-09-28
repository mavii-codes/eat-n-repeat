import crypto from "crypto";
import { menuRepository } from "@/repositories/menu.repository";
import type { MenuCategoryInput, MenuItemInput } from "@/schema/menu/menu.schema";

function toCategoryResponse(row: {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  archivedAt: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
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

export async function listMenuItems(includeArchived = false) {
  const rows = await menuRepository.findManyItems(includeArchived);
  return rows.map(toItemResponse);
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
