import crypto from "crypto";
import { cashRepository } from "@/repositories/cash.repository";
import { emitAdminEvent } from "@/lib/sse";
import { mapShift } from "./helpers";

export class StartShiftService {
  // Staff never supply the float: it always comes from the admin-configured
  // defaultOpeningFloat on their staff profile. Client-sent values are
  // ignored entirely so a tampered request cannot set its own float.
  async execute(userId: string) {
    const existing = await cashRepository.findOpenShiftByStaffId(userId);
    if (existing) {
      const err: any = new Error("You already have an open shift.");
      err.statusCode = 400;
      throw err;
    }

    const user = await cashRepository.findUserName(userId);
    const staffName = user?.name || "Staff";

    const userWithFloat = await cashRepository.findUserById(userId);
    const rawFloat = (userWithFloat as any)?.defaultOpeningFloat;
    let startingFloat = rawFloat != null ? Number(rawFloat) : 0;

    if (!Number.isFinite(startingFloat) || startingFloat <= 0) {
      startingFloat = 1000;
    }

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

    try {
      emitAdminEvent({ type: "SHIFT_UPDATED", at: new Date().toISOString() });
    } catch {
      /* event must never break the write */
    }

    return mapShift(created);
  }
}

export const startShiftService = new StartShiftService();
