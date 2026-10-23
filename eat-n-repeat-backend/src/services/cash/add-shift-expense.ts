import type { DrawerExpenseInput } from "@/schema/expenses/expenses.schema";
import { createDrawerExpenseService } from "@/services/expenses/create-drawer-expense";

/**
 * Staff drawer paid-out. Thin wrapper over the shared drawer-expense service so
 * the cash domain exposes the same atomic transaction as admin cash-drawer
 * entries.
 */
export class AddShiftExpenseService {
  async execute(userId: string, shiftId: string, input: DrawerExpenseInput) {
    return createDrawerExpenseService.execute(userId, shiftId, input, {
      source: "drawer",
    });
  }
}

export const addShiftExpenseService = new AddShiftExpenseService();
