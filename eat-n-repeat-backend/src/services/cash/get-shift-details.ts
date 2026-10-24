import { cashRepository } from "@/repositories/cash.repository";
import { expenseRepository } from "@/repositories/expense.repository";
import { mapExpense } from "@/services/expenses/helpers";
import { mapShift, mapTransaction } from "./helpers";

export class GetShiftDetailsService {
  async execute(shiftId: string) {
    const shift = await cashRepository.findShiftById(shiftId);

    if (!shift) {
      const err: any = new Error("Shift not found");
      err.statusCode = 404;
      throw err;
    }

    const transactions = await cashRepository.findTransactionsByShiftId(shiftId);
    const sales = await cashRepository.sumShiftSales(shiftId);
    const expenses = (await expenseRepository.findByShiftId(shiftId)).map(
      mapExpense,
    );

    let verifiedByName: string | null = null;
    if (shift.verifiedBy) {
      const verifier = await cashRepository.findUserName(shift.verifiedBy);
      verifiedByName = verifier?.name ?? null;
    }

    let verifiedByName: string | null = null;
    if (shift.verifiedBy) {
      const verifier = await cashRepository.findUserName(shift.verifiedBy);
      verifiedByName = verifier?.name ?? null;
    }

    return {
      shift: { ...mapShift({ ...shift, ...sales }), verified_by_name: verifiedByName },
      transactions: transactions.map(mapTransaction),
      expenses,
    };
  }
}

export const getShiftDetailsService = new GetShiftDetailsService();
