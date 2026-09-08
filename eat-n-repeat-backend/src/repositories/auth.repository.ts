import { prisma } from "@/lib/prisma";

export class AuthRepository {
  async findAllUsers() {
    return prisma.user.findMany();
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}

export const authRepository = new AuthRepository();
