// Service instances and classes (for advanced usage)
export { ListCategoriesService, listCategoriesService } from "./list-categories";
export { CreateCategoryService, createCategoryService } from "./create-category";
export { UpdateCategoryService, updateCategoryService } from "./update-category";
export { DeleteCategoryService, deleteCategoryService } from "./delete-category";

export { ListItemsService, listItemsService } from "./list-items";
export { CreateItemService, createItemService } from "./create-item";
export { UpdateItemService, updateItemService } from "./update-item";
export { DeleteItemService, deleteItemService } from "./delete-item";

export { ListRequestsService, listRequestsService } from "./list-requests";
export { CreateRequestService, createRequestService } from "./create-request";
export { UpdateRequestStatusService, updateRequestStatusService } from "./update-request-status";

export { StockInService, stockInService } from "./stock-in";
export { AdjustService, adjustService } from "./adjust";
export { ListMovementsService, listMovementsService } from "./list-movements";
export { ListItemLayersService, listItemLayersService } from "./list-item-layers";
export { SetLayerCostService, setLayerCostService } from "./set-layer-cost";
export { StockDashboardService, stockDashboardService } from "./dashboard";

// Re-export helpers
export { categoryResponse, itemResponse, requestResponse } from "./helpers";
export { serializeMovement, buildReference, StockMovementError } from "./movement-helpers";

// Convenience function wrappers that call .execute() on the service instances
import { listCategoriesService } from "./list-categories";
import { createCategoryService } from "./create-category";
import { updateCategoryService } from "./update-category";
import { deleteCategoryService } from "./delete-category";

import { listItemsService } from "./list-items";
import { createItemService } from "./create-item";
import { updateItemService } from "./update-item";
import { deleteItemService } from "./delete-item";

import { listRequestsService } from "./list-requests";
import { createRequestService } from "./create-request";
import { updateRequestStatusService } from "./update-request-status";

import { stockInService } from "./stock-in";
import { adjustService } from "./adjust";
import { listMovementsService } from "./list-movements";
import { listItemLayersService } from "./list-item-layers";
import { setLayerCostService } from "./set-layer-cost";
import { stockDashboardService } from "./dashboard";
import type { AdjustInput, MovementsQuery, StockInInput } from "@/schema/stock/movements.schema";

export async function listCategories() {
  return listCategoriesService.execute();
}

export async function createCategory(name: string) {
  return createCategoryService.execute(name);
}

export async function updateCategory(id: string, name: string) {
  return updateCategoryService.execute(id, name);
}

export async function deleteCategory(id: string) {
  return deleteCategoryService.execute(id);
}

export async function listItems() {
  return listItemsService.execute();
}

export async function createItem(data: {
  name: string;
  categoryId: string;
  quantity?: number;
  unit: string;
  lowStockThreshold: number;
}) {
  return createItemService.execute(data);
}

export async function updateItem(
  id: string,
  data: {
    name: string;
    categoryId: string;
    quantity?: number;
    unit: string;
    lowStockThreshold: number;
  },
  actor?: { id: string; name: string },
) {
  return updateItemService.execute(id, data, actor);
}

export async function deleteItem(id: string) {
  return deleteItemService.execute(id);
}

export async function listRequests() {
  return listRequestsService.execute();
}

export async function createRequest(data: {
  staffId: string;
  staffName: string;
  ingredientId: string;
  ingredientName: string;
  currentQuantity: number;
  unit: string;
  threshold: number;
  message?: string;
}) {
  return createRequestService.execute(data);
}

export async function updateRequestStatus(id: string, status: string, adminNote?: string) {
  return updateRequestStatusService.execute(id, status, adminNote);
}

export async function stockIn(
  itemId: string,
  input: StockInInput,
  actor: { id: string; name: string },
) {
  return stockInService.execute(itemId, input, actor);
}

export async function adjust(
  itemId: string,
  input: AdjustInput,
  actor: { id: string; name: string },
) {
  return adjustService.execute(itemId, input, actor);
}

export async function listMovements(query: MovementsQuery) {
  return listMovementsService.execute(query);
}

export async function listItemLayers(itemId: string) {
  return listItemLayersService.execute(itemId);
}

export async function setLayerCost(itemId: string, layerId: string, unitCost: number) {
  return setLayerCostService.execute(itemId, layerId, unitCost);
}

export async function stockDashboard() {
  return stockDashboardService.execute();
}

export { runStockConsistencyCheck } from "./consistency-check";
export { syncAllMenuItemsToStock } from "./sync-menu-to-stock";

