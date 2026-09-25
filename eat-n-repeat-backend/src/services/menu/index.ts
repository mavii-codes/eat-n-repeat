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
  description: string;
  price: unknown;
  categoryId: string;
  available: boolean;
  image: string | null;
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
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
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
