import { stockRepository } from "@/repositories/stock.repository";
import { categoryResponse } from "./helpers";

export class UpdateCategoryService {
  async execute(id: string, name: string) {
    const category = await stockRepository.updateCategory(id, name);
    return categoryResponse(category);
  }
}

export const updateCategoryService = new UpdateCategoryService();
