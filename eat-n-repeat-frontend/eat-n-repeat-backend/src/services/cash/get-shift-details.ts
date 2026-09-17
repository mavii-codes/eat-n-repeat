import { cashRepository } from "@/repositories/cash.repository";
import { mapShift, mapTransaction } from "./helpers";

export class GetShiftDetailsService {
  async execute(shiftId: string) {
    const shift = await cashRepository.findShiftById(shiftId);

    if (!shift) {
      const err: any = new Error("Shift not found");
      err.statusCode = 404;
      throw err;
    }

    const transactions = await cashRepository.findTransactionsByShiftId(shiftId);

    return {
      shift: mapShift(shift),
      transactions: transactions.map(mapTransaction),
    };
  }
}

export const getShiftDetailsService = new GetShiftDetailsService();
