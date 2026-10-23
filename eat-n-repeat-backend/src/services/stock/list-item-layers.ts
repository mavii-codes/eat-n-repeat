import type { Prisma } from "@prisma/client";
import { stockRepository } from "@/repositories/stock.repository";

/** Structural shape shared by Prisma model rows and raw layer rows. */
export type LayerSerializable = {
  id: string;
  unitCost: Prisma.Decimal | number | string | null;
  remaining: Prisma.Decimal | number | string;
  quantityReceived: Prisma.Decimal | number | string | null;
  receivedAt: Date | string | null;
  expiryDate: Date | string | null;
  isOpening: boolean | number;
  sourceRef: string | null;
  sourceMovementId: string | null;
  createdAt: Date | string;
};

/**
 * Single layer response shape used by both the layers list and the
 * set-opening-cost endpoint so the two contracts can never drift.
 */
export function serializeLayer(layer: LayerSerializable) {
  return {
    id: layer.id,
    unitCost: layer.unitCost == null ? null : Number(layer.unitCost),
    costNotSet: layer.unitCost == null,
    remaining: Number(layer.remaining),
    quantityReceived:
      layer.quantityReceived == null ? null : Number(layer.quantityReceived),
    receivedAt: layer.receivedAt ? new Date(layer.receivedAt).toISOString() : null,
    expiryDate: layer.expiryDate ? new Date(layer.expiryDate).toISOString() : null,
    isOpening: Boolean(layer.isOpening),
    sourceRef: layer.sourceRef,
    sourceMovementId: layer.sourceMovementId,
    createdAt: new Date(layer.createdAt).toISOString(),
  };
}

export class ListItemLayersService {
  async execute(itemId: string) {
    const layers = await stockRepository.findLayersForItem(itemId);
    return layers.map((layer) => serializeLayer(layer));
  }
}

export const listItemLayersService = new ListItemLayersService();
