import crypto from "crypto";
import { stockRepository } from "@/repositories/stock.repository";
import { categoryResponse } from "./helpers";

export class CreateCategoryService {
  async execute(name: string) {
    const id = `sc-${crypto.randomUUID()}`;
    const category = await stockRepository.createCategory({ id, name });
    return categoryResponse(category);
  }
}

export const createCategoryService = new CreateCategoryService();
