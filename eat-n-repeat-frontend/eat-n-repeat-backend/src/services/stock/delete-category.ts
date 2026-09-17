import { stockRepository } from "@/repositories/stock.repository";

export class DeleteCategoryService {
  async execute(id: string) {
    await stockRepository.deleteCategory(id);
  }
}

export const deleteCategoryService = new DeleteCategoryService();
