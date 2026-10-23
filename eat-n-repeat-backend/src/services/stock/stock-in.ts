import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import type { StockInInput } from "@/schema/stock/movements.schema";
import { itemResponse } from "./helpers";
import { addLayer } from "./fifo-layers";
import { buildReference, serializeMovement, StockMovementError } from "./movement-helpers";

export class StockInService {
  async execute(itemId: string, input: StockInInput, actor: { id: string; name: string }) {
    const result = await prisma.$transaction(async (tx) => {
      const row = await stockMovementsRepository.findItemForUpdate(tx, itemId);
      if (!row) {
        throw new StockMovementError("Stock item not found.", 404);
      }

      const balanceBefore = new Prisma.Decimal(row.quantity as any);
      const change = new Prisma.Decimal(input.quantity);
      const balanceAfter = balanceBefore.plus(change);
      const unitCost = new Prisma.Decimal(input.unitCost);

      const movement = await tx.stockMovement.create({
        data: {
          id: `sm-${crypto.randomUUID()}`,
          stockItemId: itemId,
          itemName: row.name,
          type: "STOCK_IN",
          quantityChange: change,
          balanceBefore,
          balanceAfter,
          unitCost,
          totalCost: unitCost.mul(change),
          reason: null,
          reference: buildReference(input.supplier, input.note),
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          createdById: actor.id,
          createdByName: actor.name,
        },
      });

      // One FIFO layer per STOCK_IN movement, in the same transaction.
      await addLayer(tx, {
        stockItemId: itemId,
        qty: change,
        unitCost,
        sourceRef: movement.id,
        receivedAt: movement.receivedAt,
        expiryDate: movement.expiryDate,
        quantityReceived: change,
        isOpening: false,
        sourceMovementId: movement.id,
      });

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

export const stockInService = new StockInService();
