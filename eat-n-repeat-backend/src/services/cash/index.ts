// Service instances and classes (for advanced usage)
export { CashIsAdminUserService, cashIsAdminUserService } from "./is-admin-user";
export { GetCurrentShiftService, getCurrentShiftService } from "./get-current-shift";
export { StartShiftService, startShiftService } from "./start-shift";
export { EndShiftService, endShiftService } from "./end-shift";
export { GetAllShiftsService, getAllShiftsService, type GetAllShiftsInput } from "./get-all-shifts";
export { GetShiftDetailsService, getShiftDetailsService } from "./get-shift-details";
export { AddFloatService, addFloatService } from "./add-float";
export { AddShiftExpenseService, addShiftExpenseService } from "./add-shift-expense";
export { VerifyShiftService, FlagShiftService, EditAuditSignoffService, verifyShiftService, flagShiftService, editAuditSignoffService } from "./verify-shift";
export { GetPosSalesTodayService, getPosSalesTodayService } from "./get-pos-sales-today";

// Re-export helpers
export { mapShift, mapTransaction } from "./helpers";

// Convenience function wrappers that call .execute() on the service instances
import { cashIsAdminUserService } from "./is-admin-user";
import { getCurrentShiftService } from "./get-current-shift";
import { startShiftService } from "./start-shift";
import { endShiftService } from "./end-shift";
import { getAllShiftsService, type GetAllShiftsInput } from "./get-all-shifts";
import { getShiftDetailsService } from "./get-shift-details";
import { addFloatService } from "./add-float";
import { addShiftExpenseService } from "./add-shift-expense";
import { verifyShiftService, flagShiftService, editAuditSignoffService } from "./verify-shift";
import { getPosSalesTodayService } from "./get-pos-sales-today";
import type { DrawerExpenseInput } from "@/schema/expenses/expenses.schema";

export async function isAdminUser(userId: string): Promise<boolean> {
  return cashIsAdminUserService.execute(userId);
}

export async function getCurrentShift(userId: string) {
  return getCurrentShiftService.execute(userId);
}

export async function startShift(userId: string) {
  return startShiftService.execute(userId);
}

export async function endShift(userId: string, shiftId: string, actualCash: number, notes?: string) {
  return endShiftService.execute(userId, shiftId, actualCash, notes);
}

export async function verifyShift(shiftId: string, adminId: string) {
  return verifyShiftService.execute(shiftId, adminId);
}

export async function flagShift(shiftId: string, adminId: string, reason: string) {
  return flagShiftService.execute(shiftId, adminId, reason);
}

export async function editAuditSignoff(shiftId: string, adminId: string, status: string, reason?: string) {
  return editAuditSignoffService.execute(shiftId, adminId, status, reason);
}

export async function getAllShifts(filters?: GetAllShiftsInput) {
  return getAllShiftsService.execute(filters);
}

export async function getShiftDetails(shiftId: string) {
  return getShiftDetailsService.execute(shiftId);
}

export async function addFloat(shiftId: string, amount: number, reason: string, adminId: string) {
  return addFloatService.execute(shiftId, amount, reason, adminId);
}

export async function addShiftExpense(
  userId: string,
  shiftId: string,
  input: DrawerExpenseInput,
) {
  return addShiftExpenseService.execute(userId, shiftId, input);
}

export async function getPosSalesToday(userId: string, isAdmin: boolean) {
  return getPosSalesTodayService.execute(userId, isAdmin);
}
