import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class GetCurrentShiftService {
  async execute(userId: string) {
    const shift = await cashRepository.findOpenShiftByStaffId(userId);
    if (!shift) return null;
    return mapShift(shift);
  }
}

export const getCurrentShiftService = new GetCurrentShiftService();
