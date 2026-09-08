import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class EndShiftService {
  async execute(userId: string, shiftId: string, actualCash: number) {
    const shift = await cashRepository.findOpenShiftByIdAndStaff(shiftId, userId);

    if (!shift) {
      const err: any = new Error("Open shift not found or already closed.");
      err.statusCode = 404;
      throw err;
    }

    const expectedCash = Number(shift.expectedCash);
    const difference = actualCash - expectedCash;

    let status = "matched";
    if (difference < -0.01) status = "short";
    if (difference > 0.01) status = "over";

    const updated = await cashRepository.updateShift(shiftId, {
      endTime: new Date(),
      actualCash,
      difference,
      status,
    });

    return mapShift(updated);
  }
}

export const endShiftService = new EndShiftService();
