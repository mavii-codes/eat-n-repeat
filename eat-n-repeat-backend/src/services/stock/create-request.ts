import crypto from "crypto";
import { stockRepository } from "@/repositories/stock.repository";
import { requestResponse } from "./helpers";

export class CreateRequestService {
  async execute(data: {
    staffId: string;
    staffName: string;
    ingredientId: string;
    ingredientName: string;
    currentQuantity: number;
    unit: string;
    threshold: number;
    message?: string;
  }) {
    const existing = await stockRepository.findFirstPendingRequest(data.ingredientId);
    if (existing) {
      const err: any = new Error("A restock request for this item is already pending Admin review.");
      err.code = "PENDING_DUPLICATE";
      throw err;
    }

    const id = `sr-${crypto.randomUUID()}`;
    const createdAt = new Date();
    const request = await stockRepository.createRequest({
      id,
      staffId: data.staffId,
      staffName: data.staffName,
      ingredientId: data.ingredientId,
      ingredientName: data.ingredientName,
      currentQuantity: data.currentQuantity,
      unit: data.unit,
      threshold: data.threshold,
      status: "Pending",
      message: data.message || null,
      adminNote: null,
      createdAt,
    });
    return requestResponse(request);
  }
}

export const createRequestService = new CreateRequestService();
