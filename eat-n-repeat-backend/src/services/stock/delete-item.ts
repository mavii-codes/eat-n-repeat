import { stockRepository } from "@/repositories/stock.repository";

export class DeleteItemService {
  async execute(id: string) {
    await stockRepository.deleteItem(id);
  }
}

export const deleteItemService = new DeleteItemService();
