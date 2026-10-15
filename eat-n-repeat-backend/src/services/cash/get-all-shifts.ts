import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class GetAllShiftsService {
  async execute() {
    const shifts = await cashRepository.findAllShifts();
    const verifierIds = Array.from(new Set(shifts.map((s) => s.verifiedBy).filter(Boolean))) as string[];
    const verifierNameMap: Record<string, string> = {};
    await Promise.all(
      verifierIds.map(async (id) => {
        const u = await cashRepository.findUserName(id);
        if (u?.name) verifierNameMap[id] = u.name;
      })
    );
    const shiftIds = shifts.map((s) => s.id);
    const salesMap = await cashRepository.sumAllShiftsSales(shiftIds);

    return shifts.map((s) => {
      const sales = salesMap[s.id] || { cash_sales: 0, gcash_sales: 0 };
      return {
        ...mapShift({ ...s, ...sales }),
        verified_by_name: s.verifiedBy ? (verifierNameMap[s.verifiedBy] ?? "Admin") : null,
      };
    });
  }
}

export const getAllShiftsService = new GetAllShiftsService();
