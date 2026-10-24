import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import { parseExpiryDate, parseReceivedAt, type StockInInput } from "@/schema/stock/movements.schema";
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
      if (row.archived) {
        throw new StockMovementError("This stock item is archived. Unarchive it or pick another item.", 409);
      }

      const balanceBefore = new Prisma.Decimal(row.quantity as any);
      const change = new Prisma.Decimal(input.quantity);
      const balanceAfter = balanceBefore.plus(change);
      const unitCost = new Prisma.Decimal(input.unitCost);

      const parsedRec = parseReceivedAt(
        input.receivedAt ? (typeof input.receivedAt === "string" ? input.receivedAt : input.receivedAt.toISOString()) : null
      );
      const receivedAtDate = parsedRec.ok ? parsedRec.date : new Date();

      let expiryDateObj: Date | null = null;
      if (input.expiryDate) {
        const parsedExp = parseExpiryDate(
          typeof input.expiryDate === "string" ? input.expiryDate : input.expiryDate.toISOString()
        );
        if (parsedExp.ok) expiryDateObj = parsedExp.date;
      }

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
          receivedAt: receivedAtDate,
          expiryDate: expiryDateObj,
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
