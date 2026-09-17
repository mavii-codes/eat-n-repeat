import { addonsRepository } from "@/repositories/addons.repository";

export class IsAdminUserService {
  async execute(userId: string): Promise<boolean> {
    const user = await addonsRepository.findUserById(userId);
    if (!user) return false;
    return user.role === "admin" || user.role === "head_staff";
  }
}

export const isAdminUserService = new IsAdminUserService();
