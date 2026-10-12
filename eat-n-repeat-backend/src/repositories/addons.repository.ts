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

  async createAddon(data: { id: string; name: string; price: number; available: boolean; image?: string | null }) {
    return prisma.addon.create({
      data: {
        id: data.id,
        name: data.name,
        price: data.price,
        available: data.available,
        image: data.image ?? null,
      },
    });
  }

  async updateAddon(id: string, data: { name: string; price: number; available: boolean; image?: string | null }) {
    return prisma.addon.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        available: data.available,
        // Absent image (e.g. availability toggles that send no photo)
        // preserves the stored photo; explicit null/empty clears it.
        ...(data.image === undefined ? {} : { image: data.image }),
      },
    });
  }

  async deleteAddon(id: string) {
    return prisma.addon.delete({ where: { id } });
  }
}

export const addonsRepository = new AddonsRepository();
