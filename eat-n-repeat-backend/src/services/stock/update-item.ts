import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { stockRepository } from "@/repositories/stock.repository";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import { addLayer, consumeFifo, lockItemForUpdate, round2 } from "./fifo-layers";
import { itemResponse } from "./helpers";
import { StockMovementError } from "./movement-helpers";

type UpdateItemData = {
  name: string;
  categoryId: string;
  quantity?: number;
  unit: string;
  lowStockThreshold: number;
};

export class UpdateItemService {
  async execute(
    id: string,
    data: UpdateItemData,
    actor?: { id: string; name: string },
  ) {
    const linkedMenu = await prisma.menuItem.findUnique({ where: { stockItemId: id } });
    if (linkedMenu) {
      if (data.name && data.name.trim().toLowerCase() !== linkedMenu.name.trim().toLowerCase()) {
        throw new StockMovementError(
          `Managed from the menu item: This stock item is linked to "${linkedMenu.name}". Rename it from the Menu Items page.`,
          409,
        );
      }
    }

    // Omitted quantity = plain field update (the legacy CRUD contract).
    if (data.quantity === undefined) {
      const item = await stockRepository.updateItem(id, data);
      return itemResponse(item);
    }

    let quantityChanged = false;

    const item = await prisma.$transaction(async (tx) => {
      // Lock first, then layers — the engine's deadlock invariant.
      const row = await lockItemForUpdate(tx, id);
      if (!row) {
        throw new StockMovementError("Stock item not found.", 404);
      }

      const balanceBefore = new Prisma.Decimal(row.quantity as any);
      const balanceAfter = new Prisma.Decimal(data.quantity!.toString());
      const delta = balanceAfter.minus(balanceBefore);

      const fields = {
        name: data.name,
        categoryId: data.categoryId,
        unit: data.unit,
        lowStockThreshold: data.lowStockThreshold,
      };

      if (delta.isZero()) {
        return tx.stockItem.update({
          where: { id },
          data: { ...fields, quantity: balanceAfter },
        });
      }

      quantityChanged = true;

      const movementId = `sm-${crypto.randomUUID()}`;
      const createdById = actor?.id ?? "system-recount";
      const createdByName = actor?.name ?? "Recount correction";

      if (delta.greaterThan(0)) {
        // Recount found extra stock: mirror ADJUSTMENT_ADD semantics — the
        // layer joins at the latest known unit cost, movement carries no
        // invented cost figure when the item was never costed.
        const lastUnitCost = await stockMovementsRepository.lastUnitCostForItem(tx, id);

        await tx.stockMovement.create({
          data: {
            id: movementId,
            stockItemId: id,
            itemName: row.name,
            type: "ADJUSTMENT_ADD",
            quantityChange: delta,
            balanceBefore,
            balanceAfter,
            unitCost: null,
            totalCost: null,
            reason: "Recount correction",
            reference: null,
            receivedAt: null,
            expiryDate: null,
            createdById,
            createdByName,
          },
        });

        await addLayer(tx, {
          stockItemId: id,
          qty: delta,
          unitCost: lastUnitCost,
          sourceRef: movementId,
          receivedAt: null,
          expiryDate: null,
          quantityReceived: delta,
          isOpening: false,
          sourceMovementId: movementId,
        });
      } else {
        // Recount found less stock: consume FIFO and record the real cost,
        // exactly like an ADJUSTMENT_REMOVE. Mixed/uncosted layers leave
        // unitCost null and totalCost at the costed portion only.
        const fifo = await consumeFifo(tx, { stockItemId: id, qty: delta.abs() });

        let unitCost: Prisma.Decimal | null = null;
        let totalCost: Prisma.Decimal | null = null;
        if (!fifo.consumedCost.isZero()) {
          totalCost = fifo.consumedCost;
          if (fifo.consumedUncostedQty.isZero()) {
            unitCost = round2(fifo.consumedCost.dividedBy(delta.abs()));
          }
        }

        await tx.stockMovement.create({
          data: {
            id: movementId,
            stockItemId: id,
            itemName: row.name,
            type: "ADJUSTMENT_REMOVE",
            quantityChange: delta,
            balanceBefore,
            balanceAfter,
            unitCost,
            totalCost,
            reason: "Recount correction",
            reference: null,
            receivedAt: null,
            expiryDate: null,
            createdById,
            createdByName,
          },
        });
      }

      return tx.stockItem.update({
        where: { id },
        data: { ...fields, quantity: balanceAfter },
      });
    });

    if (quantityChanged) {
      try {
        emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
      } catch {
        /* event must never break the write */
      }
    }

    return itemResponse(item);
  }
}

export const updateItemService = new UpdateItemService();
