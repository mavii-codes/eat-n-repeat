import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class EndShiftService {
  async execute(userId: string, shiftId: string, actualCash: number, notes?: string) {
    const shift = await cashRepository.findOpenShiftByIdAndStaff(shiftId, userId);

    if (!shift) {
      const err: any = new Error("Open shift not found or already closed.");
      err.statusCode = 404;
      throw err;
    }

    // Expected cash and variance are ALWAYS recomputed here from the
    // persisted shift row — the client never supplies them, so a tampered
    // request body cannot fake a balanced drawer.
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
      notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 2000) : null,
    });

    return mapShift(updated);
  }
}

export const endShiftService = new EndShiftService();
