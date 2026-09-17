import { prisma } from "@/lib/prisma";

export class StaffRepository {
  async findAllUsers() {
    return prisma.user.findMany();
  }

  async findUserByEmail(email: string) {
    const users = await prisma.user.findMany();
    const lower = email.toLowerCase();
    return users.find((u) => u.email.toLowerCase() === lower);
  }

  async findUserByUsername(username: string) {
    const users = await prisma.user.findMany();
    const lower = username.toLowerCase();
    return users.find((u) => u.username.toLowerCase() === lower);
  }

  async findUserByIdentifier(identifier: string) {
    const lower = identifier.toLowerCase();
    const users = await prisma.user.findMany();
    return users.find(
      (u) => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower
    );
  }

  async createUser(data: {
    id: string;
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    role: string;
    status: string;
    archived: boolean;
  }) {
    return prisma.user.create({ data });
  }

  async updateUser(
    id: string,
    data: Record<string, unknown>
  ) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}

export const staffRepository = new StaffRepository();
