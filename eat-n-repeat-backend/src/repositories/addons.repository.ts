import { prisma } from "@/lib/prisma";

export class AddonsRepository {
  async findUserById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  async findManyAddons(where: Record<string, unknown>) {
    return prisma.addon.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  }

  async createAddon(data: { id: string; name: string; price: number; available: boolean }) {
    return prisma.addon.create({
      data: {
        id: data.id,
        name: data.name,
        price: data.price,
        available: data.available,
      },
    });
  }

  async updateAddon(id: string, data: { name: string; price: number; available: boolean }) {
    return prisma.addon.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        available: data.available,
      },
    });
  }

  async deleteAddon(id: string) {
    return prisma.addon.delete({ where: { id } });
  }
}

export const addonsRepository = new AddonsRepository();
