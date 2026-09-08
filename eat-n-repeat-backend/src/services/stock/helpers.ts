export function categoryResponse(category: { id: string; name: string }) {
  return {
    id: category.id,
    name: category.name,
  };
}

export function itemResponse(item: {
  id: string;
  name: string;
  categoryId: string;
  quantity: unknown;
  unit: string;
  lowStockThreshold: unknown;
}) {
  return {
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    quantity: Number(item.quantity),
    unit: item.unit,
    lowStockThreshold: Number(item.lowStockThreshold),
  };
}

export function requestResponse(row: {
  id: string;
  staffId: string;
  staffName: string;
  ingredientId: string;
  ingredientName: string;
  currentQuantity: unknown;
  unit: string;
  threshold: unknown;
  status: string;
  message: string | null;
  adminNote: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: row.staffName,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    currentQuantity: Number(row.currentQuantity),
    unit: row.unit,
    threshold: Number(row.threshold),
    status: row.status,
    message: row.message || "",
    adminNote: row.adminNote || "",
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}
