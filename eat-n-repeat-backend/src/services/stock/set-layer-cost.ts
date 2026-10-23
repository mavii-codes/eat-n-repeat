import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitAdminEvent } from "@/lib/sse";
import { lockItemForUpdate, round2 } from "./fifo-layers";
import { serializeLayer } from "./list-item-layers";
import { StockMovementError } from "./movement-helpers";

/**
 * Sets the unit cost of an opening-balance layer exactly once.
 *
 * Opening layers are the only uncosted layers an admin may price here (they
 * predate Phase B cost capture). Movement history is never mutated.
 */
export class SetLayerCostService {
  async execute(itemId: string, layerId: string, unitCost: number) {
    const layer = await prisma.$transaction(async (tx) => {
      // Item-row lock FIRST — the engine's deadlock invariant.
      const item = await lockItemForUpdate(tx, itemId);
      if (!item) {
        throw new StockMovementError("Stock item not found.", 404);
      }

      const existing = await tx.stockLayer.findFirst({
        where: { id: layerId, stockItemId: itemId },
      });
      if (!existing) {
        throw new StockMovementError("Stock layer not found.", 404);
      }
      if (!existing.isOpening) {
        throw new StockMovementError(
          "Only opening balance layers can be costed here.",
          409,
        );
      }
      if (existing.unitCost != null) {
        throw new StockMovementError("Cost already set for this opening layer.", 409);
      }

      return tx.stockLayer.update({
        where: { id: existing.id },
        data: { unitCost: round2(new Prisma.Decimal(unitCost.toString())) },
      });
    });

    try {
      emitAdminEvent({ type: "STOCK_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return serializeLayer(layer);
  }
}

export const setLayerCostService = new SetLayerCostService();
