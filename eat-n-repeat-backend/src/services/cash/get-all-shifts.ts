import { cashRepository } from "@/repositories/cash.repository";
import { expenseRepository } from "@/repositories/expense.repository";
import { mapShift } from "./helpers";

export type GetAllShiftsInput = {
  staffId?: string;
  /** Local calendar day (YYYY-MM-DD); filters on shift start time. */
  startDate?: string;
  /** Local calendar day (YYYY-MM-DD); the whole day is included. */
  endDate?: string;
  status?: "open" | "matched";
  signoff?: "verified" | "unverified";
  sortBy?: "date" | "staff" | "variance" | "counted_cash" | "expected_cash" | "duration";
  sortDir?: "asc" | "desc";
};

type MappedShift = ReturnType<typeof mapShift>;

/** Midnight local time for a YYYY-MM-DD day (server timezone = café timezone). */
function startOfLocalDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Orders shifts in place. Open shifts are pushed last for variance/counted/
 * expected-cash sorting in BOTH directions (they have no final count yet).
 * Shift duration for open shifts is computed live (now - start), never stored.
 * A final shift-id tiebreaker keeps every ordering stable.
 */
function sortShifts(shifts: MappedShift[], sortBy: NonNullable<GetAllShiftsInput["sortBy"]>, sortDir: "asc" | "desc") {
  const direction = sortDir === "asc" ? 1 : -1;
  const now = Date.now();

  const startMs = (s: MappedShift) => new Date(s.start_time).getTime();
  const endMs = (s: MappedShift) => (s.end_time ? new Date(s.end_time).getTime() : now);
  const durationMs = (s: MappedShift) => Math.max(0, endMs(s) - startMs(s));
  const idCompare = (a: MappedShift, b: MappedShift) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

  /**
   * Classifies a pair for open-last money sorting. Open shifts (null values)
   * always sort after closed rows, regardless of direction. Returns null when
   * both values are present so the caller can compare numbers with direction.
   */
  const classifyOpenLast = (a: MappedShift, b: MappedShift, value: (s: MappedShift) => number | null) => {
    const aValue = a.status === "open" ? null : value(a);
    const bValue = b.status === "open" ? null : value(b);
    if (aValue == null && bValue == null) return "equal" as const;
    if (aValue == null) return "openLast" as const;
    if (bValue == null) return "openFirst" as const;
    return null;
  };

  shifts.sort((a, b) => {
    switch (sortBy) {
      case "staff": {
        const compare = a.staff_name.toLowerCase().localeCompare(b.staff_name.toLowerCase());
        if (compare !== 0) return compare * direction;
        break;
      }
      case "variance":
      case "counted_cash":
      case "expected_cash": {
        const value =
          sortBy === "variance"
            ? (s: MappedShift) => (s.difference == null ? null : Number(s.difference))
            : sortBy === "counted_cash"
              ? (s: MappedShift) => (s.actual_cash == null ? null : Number(s.actual_cash))
              : (s: MappedShift) => Number(s.expected_cash);
        const classification = classifyOpenLast(a, b, value);
        if (classification === "equal") break;
        if (classification === "openLast") return 1;
        if (classification === "openFirst") return -1;
        const compare = Number(value(a)) - Number(value(b));
        if (compare !== 0) return compare * direction;
        break;
      }
      case "duration": {
        const compare = durationMs(a) - durationMs(b);
        if (compare !== 0) return compare * direction;
        break;
      }
      case "date":
      default: {
        const compare = startMs(a) - startMs(b);
        if (compare !== 0) return compare * direction;
        break;
      }
    }
    return idCompare(a, b);
  });

  return shifts;
}

export class GetAllShiftsService {
<<<<<<< HEAD
  async execute(filters: GetAllShiftsInput = {}) {
    const startDate = filters.startDate ? startOfLocalDay(filters.startDate) : undefined;
    // The end date includes the entire day: filter start_time < next midnight.
    const endExclusive = filters.endDate
      ? addLocalDays(startOfLocalDay(filters.endDate), 1)
      : undefined;

    const shifts = await cashRepository.findAllShifts({
      staffId: filters.staffId,
      startDate,
      endExclusive,
      status: filters.status,
      signoff: filters.signoff,
    });

=======
  async execute() {
    const shifts = await cashRepository.findAllShifts();
>>>>>>> fix/realtime-live
    const verifierIds = Array.from(new Set(shifts.map((s) => s.verifiedBy).filter(Boolean))) as string[];
    const verifierNameMap: Record<string, string> = {};
    await Promise.all(
      verifierIds.map(async (id) => {
        const u = await cashRepository.findUserName(id);
        if (u?.name) verifierNameMap[id] = u.name;
      })
    );
<<<<<<< HEAD
    const shiftIds = shifts.map((s) => s.id);
    const salesMap = await cashRepository.sumAllShiftsSales(shiftIds);
    const expenseMap = await expenseRepository.groupNetsByShiftIds(shiftIds);

    const mapped = shifts.map((s) => {
      const sales = salesMap[s.id] || { cash_sales: 0, gcash_sales: 0 };
      const expenses = expenseMap.get(s.id) ?? { net: 0, count: 0 };
      return {
        ...mapShift(
          { ...s, ...sales },
          { expenses: expenses.net, expenses_count: expenses.count },
        ),
        verified_by_name: s.verifiedBy ? (verifierNameMap[s.verifiedBy] ?? "Admin") : null,
      };
    });

    return sortShifts(mapped, filters.sortBy ?? "date", filters.sortDir ?? "desc");
=======
    return shifts.map((s) => ({
      ...mapShift(s),
      verified_by_name: s.verifiedBy ? (verifierNameMap[s.verifiedBy] ?? "Admin") : null,
    }));
>>>>>>> fix/realtime-live
  }
}

export const getAllShiftsService = new GetAllShiftsService();
