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

// Re-export helpers
export { categoryResponse, itemResponse, requestResponse } from "./helpers";

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
  quantity: number;
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
    quantity: number;
    unit: string;
    lowStockThreshold: number;
  },
) {
  return updateItemService.execute(id, data);
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
