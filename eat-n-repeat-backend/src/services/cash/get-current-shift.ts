import { cashRepository } from "@/repositories/cash.repository";
import { expenseRepository } from "@/repositories/expense.repository";
import { mapExpense } from "@/services/expenses/helpers";
import { mapShift } from "./helpers";

export class GetCurrentShiftService {
  async execute(userId: string) {
    let shift = await cashRepository.findOpenShiftByStaffId(userId);

    if (!shift) {
      const userRole = await cashRepository.findUserRole(userId);
      if (userRole?.role === "admin") {
        shift = await cashRepository.findAnyOpenShift();
      }
    }

    if (!shift) return null;

    const sales = await cashRepository.sumShiftSales(shift.id);
    const expenses = (await expenseRepository.findByShiftId(shift.id)).map(
      mapExpense,
    );

    return {
      ...mapShift({ ...shift, ...sales }),
      expenses,
    };
  }
}

export const getCurrentShiftService = new GetCurrentShiftService();
