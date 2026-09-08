import { cashRepository } from "@/repositories/cash.repository";

export class CashIsAdminUserService {
  async execute(userId: string): Promise<boolean> {
    const user = await cashRepository.findUserRole(userId);
    return user?.role === "admin";
  }
}

export const cashIsAdminUserService = new CashIsAdminUserService();
