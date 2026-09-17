import { stockRepository } from "@/repositories/stock.repository";
import { itemResponse } from "./helpers";

export class ListItemsService {
  async execute() {
    const items = await stockRepository.findManyItems();
    return items.map(itemResponse);
  }
}

export const listItemsService = new ListItemsService();
