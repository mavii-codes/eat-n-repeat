import crypto from "crypto";
import { addonsRepository } from "@/repositories/addons.repository";
import type { AddonInput } from "@/schema/addons/addons.schema";

export class CreateAddonService {
  async execute(data: AddonInput) {
    const id = `addon-${crypto.randomUUID()}`;
    const addon = await addonsRepository.createAddon({
      id,
      name: data.name,
      price: data.price,
      available: data.available,
    });
    return { id: addon.id, name: addon.name, price: Number(addon.price), available: Boolean(addon.available) };
  }
}

export const createAddonService = new CreateAddonService();
