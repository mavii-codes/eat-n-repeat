import { stockRepository } from "@/repositories/stock.repository";
import { requestResponse } from "./helpers";

export class ListRequestsService {
  async execute() {
    const requests = await stockRepository.findManyRequests();
    return requests.map(requestResponse);
  }
}

export const listRequestsService = new ListRequestsService();
