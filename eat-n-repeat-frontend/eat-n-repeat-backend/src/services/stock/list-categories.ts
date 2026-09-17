import { stockRepository } from "@/repositories/stock.repository";
import { categoryResponse } from "./helpers";

export class ListCategoriesService {
  async execute() {
    const categories = await stockRepository.findManyCategories();
    return categories.map(categoryResponse);
  }
}

export const listCategoriesService = new ListCategoriesService();
