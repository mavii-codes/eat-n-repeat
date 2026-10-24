import crypto from "crypto";
import { stockRepository } from "@/repositories/stock.repository";
import { itemResponse } from "./helpers";

export class CreateItemService {
  async execute(data: {
    name: string;
    categoryId: string;
    quantity?: number;
    unit: string;
    lowStockThreshold: number;
    /** "ingredient" (Inventory UI) by default; the menu flow passes "menu". */
    kind?: string;
  }) {
    const id = `st-${crypto.randomUUID()}`;
    const item = await stockRepository.createItem({
      id,
      name: data.name,
      categoryId: data.categoryId,
      // New items always start at zero; stock arrives through Stock In.
      quantity: data.quantity ?? 0,
      unit: data.unit,
      lowStockThreshold: data.lowStockThreshold,
      kind: data.kind ?? "ingredient",
    });
    return itemResponse(item);
  }
}

export const createItemService = new CreateItemService();
