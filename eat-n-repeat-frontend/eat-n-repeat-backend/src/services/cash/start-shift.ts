import crypto from "crypto";
import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class StartShiftService {
  async execute(userId: string, startingFloat: number) {
    const existing = await cashRepository.findOpenShiftByStaffId(userId);
    if (existing) {
      const err: any = new Error("You already have an open shift.");
      err.statusCode = 400;
      throw err;
    }

    const user = await cashRepository.findUserName(userId);
    const staffName = user?.name || "Staff";

    const shiftId = `shift-${crypto.randomUUID()}`;

    const created = await cashRepository.createShift({
      id: shiftId,
      staffId: userId,
      staffName,
      startingFloat,
      expectedCash: startingFloat,
      status: "open",
      startTime: new Date(),
    });

    return mapShift(created);
  }
}

export const startShiftService = new StartShiftService();
