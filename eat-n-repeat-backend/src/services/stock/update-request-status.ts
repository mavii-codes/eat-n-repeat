import { stockRepository } from "@/repositories/stock.repository";
import { requestResponse } from "./helpers";

export class UpdateRequestStatusService {
  async execute(id: string, status: string, adminNote?: string) {
    const updated = await stockRepository.updateRequest(id, {
      status,
      adminNote: adminNote || null,
    });
    return requestResponse(updated);
  }
}

export const updateRequestStatusService = new UpdateRequestStatusService();
