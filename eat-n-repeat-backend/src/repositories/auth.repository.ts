import { prisma } from "@/lib/prisma";

export class AuthRepository {
  async findAllUsers() {
    return prisma.user.findMany();
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async updateLastLoginAt(id: string, at: Date = new Date()) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: at },
      select: { id: true },
    });
  }
}

export const authRepository = new AuthRepository();
