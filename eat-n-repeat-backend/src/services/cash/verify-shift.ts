import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";
import { cashIsAdminUserService } from "./is-admin-user";

async function requireAuditor(adminId: string) {
  const isAdmin = await cashIsAdminUserService.execute(adminId);
  if (!isAdmin) {
    const err: any = new Error("Admin access required.");
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
    await requireAuditor(adminId);
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
    await requireAuditor(adminId);
    const cleanReason = (reason || "").trim().slice(0, 255);
    if (!cleanReason) {
      const err: any = new Error("A flag reason is required.");
      err.statusCode = 400;
      throw err;
    }
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

export class EditAuditSignoffService {
  async execute(shiftId: string, adminId: string, targetStatus: string, reason?: string) {
    const shift = await cashRepository.findShiftById(shiftId);
    if (!shift) {
      const err: any = new Error("Shift not found.");
      err.statusCode = 404;
      throw err;
    }
    if (shift.status === "open") {
      const err: any = new Error("Only closed shifts can have audit sign-off modified.");
      err.statusCode = 400;
      throw err;
    }
    await requireAuditor(adminId);

    const normStatus = (targetStatus || "").toLowerCase().trim();
    if (!["unverified", "verified", "flagged"].includes(normStatus)) {
      const err: any = new Error("Invalid audit sign-off status.");
      err.statusCode = 400;
      throw err;
    }

    let updateData: {
      verificationStatus: string;
      verifiedBy: string | null;
      verifiedAt: Date | null;
      flagReason: string | null;
    };

    if (normStatus === "verified") {
      updateData = {
        verificationStatus: "verified",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        flagReason: null,
      };
    } else if (normStatus === "flagged") {
      const cleanReason = (reason || "").trim().slice(0, 255);
      if (!cleanReason) {
        const err: any = new Error("A flag reason is required.");
        err.statusCode = 400;
        throw err;
      }
      updateData = {
        verificationStatus: "flagged",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        flagReason: cleanReason,
      };
    } else {
      // unverified
      updateData = {
        verificationStatus: "unverified",
        verifiedBy: null,
        verifiedAt: null,
        flagReason: null,
      };
    }

    const updated = await cashRepository.updateShift(shiftId, updateData);
    const adminUser = await cashRepository.findUserName(adminId);
    return {
      ...mapShift(updated),
      verified_by_name: normStatus === "unverified" ? null : (adminUser?.name ?? "Admin"),
    };
  }
}

export const verifyShiftService = new VerifyShiftService();
export const flagShiftService = new FlagShiftService();
export const editAuditSignoffService = new EditAuditSignoffService();
