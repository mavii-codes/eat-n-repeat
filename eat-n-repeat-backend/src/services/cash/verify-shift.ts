import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";
import { cashIsAdminUserService } from "./is-admin-user";

async function requireAuditor(adminId: string, shiftStaffId: string) {
  const isAdmin = await cashIsAdminUserService.execute(adminId);
  if (!isAdmin) {
    const err: any = new Error("Admin access required.");
    err.statusCode = 403;
    throw err;
  }
  // Staff must never verify their own shift — not even admin-owners
  // reviewing their own cashier shift.
  if (adminId === shiftStaffId) {
    const err: any = new Error("You cannot verify your own shift.");
    err.statusCode = 403;
    throw err;
  }
}

export class VerifyShiftService {
  async execute(shiftId: string, adminId: string) {
    const shift = await cashRepository.findShiftById(shiftId);
    if (!shift) {
      const err: any = new Error("Shift not found.");
      err.statusCode = 404;
      throw err;
    }
    if (shift.status === "open") {
      const err: any = new Error("Only closed shifts can be verified.");
      err.statusCode = 400;
      throw err;
    }
    await requireAuditor(adminId, shift.staffId);
    if (shift.verificationStatus === "verified") {
      const err: any = new Error("Shift is already verified.");
      err.statusCode = 400;
      throw err;
    }
    const adminUser = await cashRepository.findUserName(adminId);
    const updated = await cashRepository.updateShift(shiftId, {
      verificationStatus: "verified",
      verifiedBy: adminId,
      verifiedAt: new Date(),
      flagReason: null,
    });
    return { ...mapShift(updated), verified_by_name: adminUser?.name ?? "Admin" };
  }
}

export class FlagShiftService {
  async execute(shiftId: string, adminId: string, reason: string) {
    const shift = await cashRepository.findShiftById(shiftId);
    if (!shift) {
      const err: any = new Error("Shift not found.");
      err.statusCode = 404;
      throw err;
    }
    if (shift.status === "open") {
      const err: any = new Error("Only closed shifts can be flagged.");
      err.statusCode = 400;
      throw err;
    }
    await requireAuditor(adminId, shift.staffId);
    const cleanReason = (reason || "").trim().slice(0, 255);
    if (!cleanReason) {
      const err: any = new Error("A flag reason is required.");
      err.statusCode = 400;
      throw err;
    }
    // Flagging never auto-verifies: a discrepant shift stays unverified
    // until an auditor explicitly signs it off via verify.
    const adminUser = await cashRepository.findUserName(adminId);
    const updated = await cashRepository.updateShift(shiftId, {
      verificationStatus: "flagged",
      verifiedBy: adminId,
      verifiedAt: new Date(),
      flagReason: cleanReason,
    });
    return { ...mapShift(updated), verified_by_name: adminUser?.name ?? "Admin" };
  }
}

export const verifyShiftService = new VerifyShiftService();
export const flagShiftService = new FlagShiftService();
