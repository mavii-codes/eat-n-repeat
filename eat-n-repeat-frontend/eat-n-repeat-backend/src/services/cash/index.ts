// Service instances and classes (for advanced usage)
export { CashIsAdminUserService, cashIsAdminUserService } from "./is-admin-user";
export { GetCurrentShiftService, getCurrentShiftService } from "./get-current-shift";
export { StartShiftService, startShiftService } from "./start-shift";
export { EndShiftService, endShiftService } from "./end-shift";
export { GetAllShiftsService, getAllShiftsService } from "./get-all-shifts";
export { GetShiftDetailsService, getShiftDetailsService } from "./get-shift-details";
export { AddFloatService, addFloatService } from "./add-float";

// Re-export helpers
export { mapShift, mapTransaction } from "./helpers";

// Convenience function wrappers that call .execute() on the service instances
import { cashIsAdminUserService } from "./is-admin-user";
import { getCurrentShiftService } from "./get-current-shift";
import { startShiftService } from "./start-shift";
import { endShiftService } from "./end-shift";
import { getAllShiftsService } from "./get-all-shifts";
import { getShiftDetailsService } from "./get-shift-details";
import { addFloatService } from "./add-float";

export async function isAdminUser(userId: string): Promise<boolean> {
  return cashIsAdminUserService.execute(userId);
}

export async function getCurrentShift(userId: string) {
  return getCurrentShiftService.execute(userId);
}

export async function startShift(userId: string, startingFloat: number) {
  return startShiftService.execute(userId, startingFloat);
}

export async function endShift(userId: string, shiftId: string, actualCash: number) {
  return endShiftService.execute(userId, shiftId, actualCash);
}

export async function getAllShifts() {
  return getAllShiftsService.execute();
}

export async function getShiftDetails(shiftId: string) {
  return getShiftDetailsService.execute(shiftId);
}

export async function addFloat(shiftId: string, amount: number, reason: string, adminId: string) {
  return addFloatService.execute(shiftId, amount, reason, adminId);
}
