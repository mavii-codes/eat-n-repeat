import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { addLayer, consumeFifo, lockItemForUpdate, round2 } from "./fifo-layers";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import { StockMovementError } from "./movement-helpers";

export interface OrderItemDeductionRequest {
  menuItemId?: string;
  id?: string;
  name?: string;
  quantity: number;
}

/**
 * Validates stock availability and deducts stock for tracked menu items during checkout.
 * Runs inside the caller's Prisma transaction (tx).
 * Fulfills D1: Blocks selling when stock is 0 or insufficient for tracked items.
 * Fulfills D2: Deducts stock when order is created, creating auditable movements.
 */
export async function deductTrackedStockForOrder(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber?: string } | string,
  items: OrderItemDeductionRequest[],
  actor?: { id: string; name?: string } | string,
) {
  if (!items || items.length === 0) return [];
  const orderObj = typeof order === "string" ? { id: order, orderNumber: order } : { id: order.id, orderNumber: order.orderNumber || order.id };
  const actorObj = typeof actor === "string" ? { id: actor, name: "Staff" } : actor && actor.id ? { id: actor.id, name: actor.name || "Staff" } : { id: "system", name: "System" };

  // Group requested quantity by menuItemId or id
  const requestedByMenuId = new Map<string, number>();
  for (const item of items) {
    const rawId = item.menuItemId || item.id;
    if (!rawId) continue;
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    requestedByMenuId.set(rawId, (requestedByMenuId.get(rawId) ?? 0) + qty);
  }

  if (requestedByMenuId.size === 0) return [];

  // Fetch the menu items to see which ones are tracked
  const menuRows = await tx.menuItem.findMany({
    where: { id: { in: [...requestedByMenuId.keys()] } },
    select: { id: true, name: true, stockItemId: true, stockMode: true },
  });

  const trackedMenuMap = new Map<string, { id: string; name: string; stockItemId: string }>();
  for (const m of menuRows) {
    if (m.stockMode === "DIRECT" && m.stockItemId) {
      trackedMenuMap.set(m.id, { id: m.id, name: m.name, stockItemId: m.stockItemId });
    }
  }

  // If no tracked items in order, nothing to deduct
  if (trackedMenuMap.size === 0) return [];

  // Group deductions by stockItemId
  const qtyByStockId = new Map<string, { qty: number; menuName: string }>();
  for (const [menuId, qty] of requestedByMenuId.entries()) {
    const tracked = trackedMenuMap.get(menuId);
    if (!tracked) continue;
    const existing = qtyByStockId.get(tracked.stockItemId);
    if (existing) {
      existing.qty += qty;
    } else {
      qtyByStockId.set(tracked.stockItemId, { qty, menuName: tracked.name });
    }
  }

  const deductions = [];

  // Sort stockItemIds to avoid deadlocks across concurrent orders
  const sortedStockIds = [...qtyByStockId.keys()].sort();

  for (const stockItemId of sortedStockIds) {
    const { qty, menuName } = qtyByStockId.get(stockItemId)!;
    const decimalQty = new Prisma.Decimal(qty);

    // Lock stock item
    const stockRow = await lockItemForUpdate(tx, stockItemId);
    if (!stockRow) {
      throw new StockMovementError(`Tracked inventory item for "${menuName}" not found.`, 404);
    }

    const balanceBefore = new Prisma.Decimal(stockRow.quantity as any);
    if (balanceBefore.lessThan(decimalQty)) {
      throw new StockMovementError(
        `Insufficient stock for "${menuName}". On hand: ${balanceBefore.toFixed(2)} ${stockRow.unit}, requested: ${decimalQty.toFixed(2)} ${stockRow.unit}.`,
        400,
      );
    }

    // Consume FIFO
    const fifo = await consumeFifo(tx, { stockItemId, qty: decimalQty });
    const balanceAfter = balanceBefore.minus(decimalQty);

    await tx.stockItem.update({
      where: { id: stockItemId },
      data: { quantity: balanceAfter },
    });

    const unitCost =
      fifo.consumedUncostedQty.isZero() && !fifo.consumedCost.isZero() && !decimalQty.isZero()
        ? round2(fifo.consumedCost.dividedBy(decimalQty))
        : null;

    const movement = await tx.stockMovement.create({
      data: {
        id: `sm-${crypto.randomUUID()}`,
        stockItemId,
        itemName: stockRow.name,
        type: "SALE_DEDUCTION",
        quantityChange: decimalQty.negated(),
        balanceBefore,
        balanceAfter,
        unitCost,
        totalCost: fifo.consumedCost.isZero() ? null : fifo.consumedCost,
        reason: `Order ${orderObj.orderNumber}`,
        reference: orderObj.id,
        createdById: actorObj.id,
        createdByName: actorObj.name,
      },
    });

    deductions.push(movement);
  }

  return deductions;
}

/**
 * Releases deducted stock for an order when it is cancelled, failed, or expired.
 * Idempotent: will not release twice if already released.
 * Fulfills D2.
 */
export async function releaseStockForOrder(
  orderId: string,
  reason = "Order cancelled",
  actor: { id: string; name?: string } | string = { id: "system", name: "System" },
) {
  const actorObj = typeof actor === "string" ? { id: actor, name: "Staff" } : actor && actor.id ? { id: actor.id, name: actor.name || "Staff" } : { id: "system", name: "System" };
  return prisma.$transaction(async (tx) => {
    // Check if there are any SALE_DEDUCTION movements for this order
    const deductions = await tx.stockMovement.findMany({
      where: { reference: orderId, type: "SALE_DEDUCTION" },
    });

    if (deductions.length === 0) {
      return { releasedCount: 0 };
    }

    // Check if already released
    const alreadyReleased = await tx.stockMovement.findFirst({
      where: { reference: orderId, type: "SALE_CANCEL_RELEASE" },
    });

    if (alreadyReleased) {
      return { releasedCount: 0, alreadyReleased: true };
    }

    for (const ded of deductions) {
      const stockItemId = ded.stockItemId;
      const qtyToReturn = ded.quantityChange.abs();

      const stockRow = await lockItemForUpdate(tx, stockItemId);
      if (!stockRow) continue;

      const balanceBefore = new Prisma.Decimal(stockRow.quantity as any);
      const balanceAfter = balanceBefore.plus(qtyToReturn);

      // Re-add to FIFO layers at the consumed unit cost or item's last unit cost
      const returnUnitCost =
        ded.unitCost ?? (await stockMovementsRepository.lastUnitCostForItem(tx, stockItemId));

      const releaseMovement = await tx.stockMovement.create({
        data: {
          id: `sm-${crypto.randomUUID()}`,
          stockItemId,
          itemName: stockRow.name,
          type: "SALE_CANCEL_RELEASE",
          quantityChange: qtyToReturn,
          balanceBefore,
          balanceAfter,
          unitCost: returnUnitCost,
          totalCost: ded.totalCost,
          reason: `${reason}: ${ded.reason ?? orderId}`,
          reference: orderId,
          createdById: actorObj.id,
          createdByName: actorObj.name,
        },
      });

      await addLayer(tx, {
        stockItemId,
        qty: qtyToReturn,
        unitCost: returnUnitCost,
        sourceRef: `release-${orderId}`,
        receivedAt: new Date(),
        expiryDate: null,
        quantityReceived: qtyToReturn,
        isOpening: false,
        sourceMovementId: releaseMovement.id,
      });

      await tx.stockItem.update({
        where: { id: stockItemId },
        data: { quantity: balanceAfter },
      });
    }

    try {
      emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the transaction */
    }

    return { releasedCount: deductions.length };
  });
}
