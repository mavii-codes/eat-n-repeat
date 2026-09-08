import { stockRepository } from "@/repositories/stock.repository";
import { itemResponse } from "./helpers";

export class UpdateItemService {
  async execute(
    id: string,
    data: {
      name: string;
      categoryId: string;
      quantity: number;
      unit: string;
      lowStockThreshold: number;
    },
  ) {
    const item = await stockRepository.updateItem(id, data);
    return itemResponse(item);
  }
}

export const updateItemService = new UpdateItemService();
