import type { StockMovement } from "@prisma/client";

/** Service-layer error carrying the HTTP status the controller should map. */
export class StockMovementError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StockMovementError";
    this.status = status;
  }
}

export function serializeMovement(movement: StockMovement) {
  return {
    id: movement.id,
    stockItemId: movement.stockItemId,
    itemName: movement.itemName,
    type: movement.type,
    quantityChange: Number(movement.quantityChange),
    balanceBefore: Number(movement.balanceBefore),
    balanceAfter: Number(movement.balanceAfter),
    unitCost: movement.unitCost == null ? null : Number(movement.unitCost),
    totalCost: movement.totalCost == null ? null : Number(movement.totalCost),
    reason: movement.reason,
    reference: movement.reference,
    receivedAt: movement.receivedAt ? new Date(movement.receivedAt).toISOString() : null,
    expiryDate: movement.expiryDate ? new Date(movement.expiryDate).toISOString() : null,
    createdById: movement.createdById,
    createdByName: movement.createdByName,
    createdAt: new Date(movement.createdAt).toISOString(),
  };
}

/** `supplier — note`, whichever single value exists, or null. */
export function buildReference(
  supplier?: string | null,
  note?: string | null,
): string | null {
  const supplierText = supplier?.trim();
  const noteText = note?.trim();
  if (supplierText && noteText) return `${supplierText} — ${noteText}`;
  return supplierText || noteText || null;
}
