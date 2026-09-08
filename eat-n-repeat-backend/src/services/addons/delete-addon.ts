import { addonsRepository } from "@/repositories/addons.repository";

export class DeleteAddonService {
  async execute(id: string) {
    await addonsRepository.deleteAddon(id);
  }
}

export const deleteAddonService = new DeleteAddonService();
