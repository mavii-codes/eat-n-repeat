import { addonsRepository } from "@/repositories/addons.repository";

function mapAddon(row: { id: string; name: string; price: any; available: boolean; image?: string | null; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    available: Boolean(row.available),
    image: row.image ?? null,
    createdAt: row.createdAt,
  };
}

export class GetAddonsService {
  async execute(isAdmin: boolean) {
    const addons = await addonsRepository.findManyAddons(isAdmin ? {} : { available: true });
    return addons.map((addon) => mapAddon(addon));
  }
}

export const getAddonsService = new GetAddonsService();
