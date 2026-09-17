import { cashRepository } from "@/repositories/cash.repository";
import { mapShift } from "./helpers";

export class GetAllShiftsService {
  async execute() {
    const shifts = await cashRepository.findAllShifts();
    return shifts.map(mapShift);
  }
}

export const getAllShiftsService = new GetAllShiftsService();
