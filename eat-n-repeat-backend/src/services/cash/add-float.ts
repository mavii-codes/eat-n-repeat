import crypto from "crypto";
import { cashRepository } from "@/repositories/cash.repository";

export class AddFloatService {
  async execute(
    shiftId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    const shift = await cashRepository.findShiftById(shiftId);

    if (!shift) {
      const err: any = new Error("Shift not found");
      err.statusCode = 404;
      throw err;
    }

    if (shift.status !== "open") {
      const err: any = new Error("Cannot add float to a closed shift");
      err.statusCode = 400;
      throw err;
    }

    const adminUser = await cashRepository.findUserName(adminId);
    const adminName = adminUser?.name || "Admin";

    const txId = `tx-${crypto.randomUUID()}`;

    await cashRepository.updateShift(shiftId, {
      expectedCash: { increment: amount },
    });

    await cashRepository.createTransaction({
      id: txId,
      shiftId,
      type: "float_addition",
      amount,
      adminId,
      adminName,
      reason,
      timestamp: new Date(),
    });
  }
}

export const addFloatService = new AddFloatService();
