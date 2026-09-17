import { addonsRepository } from "@/repositories/addons.repository";
import type { AddonInput } from "@/schema/addons/addons.schema";

export class UpdateAddonService {
  async execute(id: string, data: AddonInput) {
    const addon = await addonsRepository.updateAddon(id, {
      name: data.name,
      price: data.price,
      available: data.available,
    });
    return { id: addon.id, name: addon.name, price: Number(addon.price), available: Boolean(addon.available) };
  }
}

export const updateAddonService = new UpdateAddonService();
