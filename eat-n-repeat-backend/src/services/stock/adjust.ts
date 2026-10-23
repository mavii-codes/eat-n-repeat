import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import type { AdjustInput } from "@/schema/stock/movements.schema";
import { itemResponse } from "./helpers";
import { addLayer, consumeFifo, round2 } from "./fifo-layers";
import { serializeMovement, StockMovementError } from "./movement-helpers";

export class AdjustService {
  async execute(itemId: string, input: AdjustInput, actor: { id: string; name: string }) {
    const result = await prisma.$transaction(async (tx) => {
      const row = await stockMovementsRepository.findItemForUpdate(tx, itemId);
      if (!row) {
        throw new StockMovementError("Stock item not found.", 404);
      }

      const balanceBefore = new Prisma.Decimal(row.quantity as any);
      const change = new Prisma.Decimal(input.quantity);
      const isAdd = input.direction === "add";
      const balanceAfter = isAdd
        ? balanceBefore.plus(change)
        : balanceBefore.minus(change);

      if (balanceAfter.isNegative()) {
        throw new StockMovementError("Cannot remove more than is on hand.", 409);
      }

      let movementUnitCost: Prisma.Decimal | null = null;
      let movementTotalCost: Prisma.Decimal | null = null;
      // Additions join FIFO at the item's latest known cost (null when the
      // item has never been costed). Removals consume oldest layers first.
      let layerUnitCost: Prisma.Decimal | null = null;

      if (isAdd) {
        layerUnitCost = await stockMovementsRepository.lastUnitCostForItem(tx, itemId);
      } else {
        const fifo = await consumeFifo(tx, { stockItemId: itemId, qty: change });
        // Mixed (costed + uncosted) or fully uncosted removals cannot state a
        // clean per-unit figure. In that case unitCost stays null and
        // totalCost carries only the costed portion; the dashboard's estimate
        // flag already communicates the uncosted remainder.
        if (!fifo.consumedCost.isZero()) {
          movementTotalCost = fifo.consumedCost;
          if (fifo.consumedUncostedQty.isZero()) {
            movementUnitCost = round2(fifo.consumedCost.dividedBy(change));
          }
        }
      }

      const movement = await tx.stockMovement.create({
        data: {
          id: `sm-${crypto.randomUUID()}`,
          stockItemId: itemId,
          itemName: row.name,
          type: isAdd ? "ADJUSTMENT_ADD" : "ADJUSTMENT_REMOVE",
          quantityChange: isAdd ? change : change.negated(),
          balanceBefore,
          balanceAfter,
          unitCost: movementUnitCost,
          totalCost: movementTotalCost,
          reason: input.reason,
          reference: input.note || null,
          receivedAt: null,
          expiryDate: null,
          createdById: actor.id,
          createdByName: actor.name,
        },
      });

      if (isAdd) {
        await addLayer(tx, {
          stockItemId: itemId,
          qty: change,
          unitCost: layerUnitCost,
          sourceRef: movement.id,
          receivedAt: null,
          expiryDate: null,
          quantityReceived: change,
          isOpening: false,
          sourceMovementId: movement.id,
        });
      }

      const item = await tx.stockItem.update({
        where: { id: itemId },
        data: { quantity: balanceAfter },
      });

      return { movement, item };
    });

    try {
      emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return {
      movement: serializeMovement(result.movement),
      item: itemResponse(result.item),
    };
  }
}

export const adjustService = new AdjustService();
