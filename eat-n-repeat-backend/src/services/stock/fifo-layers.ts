import crypto from "crypto";
import { Prisma } from "@prisma/client";

/**
 * FIFO cost-layer engine.
 *
 * DEADLOCK INVARIANT (structural): every transaction that reads or writes
 * `stock_layers` MUST lock the owning `stock_items` row FIRST. The item-row
 * lock always precedes any layer locks. All callers (stock-in, adjustments,
 * recount updates, offline drain, backfill) follow the same order, so two
 * concurrent writers can never hold layer locks while waiting for an item
 * lock (which would invert the order and deadlock).
 *
 * Helpers here accept the Prisma transaction client so callers can compose
 * them inside their own `$transaction`.
 */

export type LockedStockItemRow = {
  id: string;
  quantity: Prisma.Decimal | number | string;
  name: string;
  unit: string;
  low_stock_threshold: Prisma.Decimal | number | string;
};

export type StockLayerRow = {
  id: string;
  remaining: Prisma.Decimal | number | string;
  unitCost: Prisma.Decimal | number | string | null;
  sourceRef: string | null;
  createdAt: Date;
  receivedAt: Date | null;
  expiryDate: Date | null;
  quantityReceived: Prisma.Decimal | number | string | null;
  /** Raw MySQL returns TINYINT(1) as 0/1; Prisma model rows return a boolean. */
  isOpening: boolean | number;
  sourceMovementId: string | null;
};

export type LayersUsed = {
  id: string;
  unitCost: Prisma.Decimal | null;
  amount: Prisma.Decimal;
};

/** Quantize to the Decimal(10,2) columns (never used via Number()). */
export function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

/**
 * Locks the stock item row for the duration of the surrounding transaction.
 * Mirrors stockMovementsRepository.findItemForUpdate semantics.
 */
export async function lockItemForUpdate(
  tx: Prisma.TransactionClient,
  itemId: string,
): Promise<LockedStockItemRow | null> {
  const rows = await tx.$queryRaw<LockedStockItemRow[]>`
    SELECT id, quantity, name, unit, low_stock_threshold
    FROM stock_items
    WHERE id = ${itemId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/** Inserts one layer. Caller must already hold the item-row lock. */
export async function addLayer(
  tx: Prisma.TransactionClient,
  input: {
    stockItemId: string;
    qty: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    sourceRef: string | null;
    receivedAt?: Date | null;
    expiryDate?: Date | null;
    quantityReceived?: Prisma.Decimal | null;
    isOpening?: boolean;
    sourceMovementId?: string | null;
  },
) {
  return tx.stockLayer.create({
    data: {
      id: `sl-${crypto.randomUUID()}`,
      stockItemId: input.stockItemId,
      unitCost: input.unitCost,
      remaining: round2(input.qty),
      sourceRef: input.sourceRef,
      receivedAt: input.receivedAt ?? null,
      expiryDate: input.expiryDate ?? null,
      quantityReceived:
        input.quantityReceived === undefined ? round2(input.qty) : input.quantityReceived,
      isOpening: input.isOpening ?? false,
      sourceMovementId:
        input.sourceMovementId === undefined
          ? input.sourceRef?.startsWith("sm-")
            ? input.sourceRef
            : null
          : input.sourceMovementId,
    },
  });
}

/** FOR UPDATE read (created_at ASC, id ASC) used by the consumption walk. */
export async function listLayersForItem(
  tx: Prisma.TransactionClient,
  itemId: string,
): Promise<StockLayerRow[]> {
  return tx.$queryRaw<StockLayerRow[]>`
    SELECT id, remaining, unit_cost AS unitCost, source_ref AS sourceRef, created_at AS createdAt,
           received_at AS receivedAt, expiry_date AS expiryDate,
           quantity_received AS quantityReceived, is_opening AS isOpening,
           source_movement_id AS sourceMovementId
    FROM stock_layers
    WHERE stock_item_id = ${itemId}
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  `;
}

/**
 * Consumes `qty` from the item's FIFO layers.
 *
 * Precondition: the caller has already locked the item row inside this same
 * transaction. If the layer total is short of the item's on-hand quantity we
 * insert a null-cost "residual" layer for the gap first, so any consumption up
 * to the item quantity is always coverable. Layers that reach exactly zero are
 * deleted.
 *
 * Returns the costed portion (consumedCost), the quantity taken from uncosted
 * layers (consumedUncostedQty), and the exact layers touched.
 */
export async function consumeFifo(
  tx: Prisma.TransactionClient,
  input: { stockItemId: string; qty: Prisma.Decimal },
): Promise<{
  consumedCost: Prisma.Decimal;
  consumedUncostedQty: Prisma.Decimal;
  layersUsed: LayersUsed[];
}> {
  const { stockItemId, qty } = input;
  if (qty.isNegative()) {
    throw new Error("Cannot consume a negative FIFO quantity.");
  }

  // Re-read the item quantity inside the transaction. The caller's lock makes
  // this stable for the remainder of the transaction.
  const itemRows = await tx.$queryRaw<Array<{ quantity: Prisma.Decimal | number | string }>>`
    SELECT quantity FROM stock_items WHERE id = ${stockItemId}
  `;
  if (!itemRows[0]) {
    throw new Error(`Stock item "${stockItemId}" not found while consuming FIFO layers.`);
  }
  const onHand = new Prisma.Decimal(itemRows[0].quantity as any);

  const rows = await listLayersForItem(tx, stockItemId);

  let layerTotal = new Prisma.Decimal(0);
  for (const row of rows) {
    layerTotal = layerTotal.plus(new Prisma.Decimal(row.remaining as any));
  }

  if (layerTotal.lessThan(onHand)) {
    const residualQty = onHand.minus(layerTotal);
    const residual = await addLayer(tx, {
      stockItemId,
      qty: residualQty,
      unitCost: null,
      sourceRef: "residual",
      receivedAt: null,
      expiryDate: null,
      quantityReceived: residualQty,
      isOpening: false,
      sourceMovementId: null,
    });
    rows.push({
      id: residual.id,
      remaining: residual.remaining,
      unitCost: residual.unitCost,
      sourceRef: residual.sourceRef,
      createdAt: residual.createdAt,
      receivedAt: residual.receivedAt,
      expiryDate: residual.expiryDate,
      quantityReceived: residual.quantityReceived,
      isOpening: residual.isOpening,
      sourceMovementId: residual.sourceMovementId,
    });
    layerTotal = layerTotal.plus(new Prisma.Decimal(residual.remaining as any));
  }

  let remainingToTake = qty;
  let consumedCost = new Prisma.Decimal(0);
  let consumedUncostedQty = new Prisma.Decimal(0);
  const layersUsed: LayersUsed[] = [];

  for (const row of rows) {
    if (remainingToTake.isZero()) break;

    const available = new Prisma.Decimal(row.remaining as any);
    if (available.isNegative()) {
      throw new Error(`Stock layer "${row.id}" has a negative remaining quantity.`);
    }
    if (available.isZero()) {
      await tx.stockLayer.delete({ where: { id: row.id } });
      continue;
    }

    const take = Prisma.Decimal.min(available, remainingToTake);
    const unitCost = row.unitCost == null ? null : new Prisma.Decimal(row.unitCost as any);

    if (unitCost == null) {
      consumedUncostedQty = consumedUncostedQty.plus(take);
    } else {
      consumedCost = consumedCost.plus(take.mul(unitCost));
    }
    layersUsed.push({ id: row.id, unitCost, amount: take });

    const nextRemaining = round2(available.minus(take));
    if (nextRemaining.isZero()) {
      await tx.stockLayer.delete({ where: { id: row.id } });
    } else {
      await tx.stockLayer.update({
        where: { id: row.id },
        data: { remaining: nextRemaining },
      });
    }

    remainingToTake = remainingToTake.minus(take);
  }

  if (!remainingToTake.isZero()) {
    // Callers clamp `qty` to the on-hand quantity; the residual heal above
    // guarantees the layers cover it. Reaching here means that invariant broke.
    throw new Error(
      `FIFO layer shortfall for stock item "${stockItemId}": ${remainingToTake.toString()} unconsumed.`,
    );
  }

  return {
    consumedCost: round2(consumedCost),
    consumedUncostedQty: round2(consumedUncostedQty),
    layersUsed,
  };
}
