import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class GetCurrentShiftService {
  async execute(userId: string) {
    const shift = await cashRepository.findOpenShiftByStaffId(userId);
    if (!shift) return null;

    const sales = await cashRepository.sumShiftSales(shift.id);
    return mapShift({ ...shift, ...sales });
  }
}

export const getCurrentShiftService = new GetCurrentShiftService();
