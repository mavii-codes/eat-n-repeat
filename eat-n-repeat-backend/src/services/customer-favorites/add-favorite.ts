import { customerFavoritesRepository } from "@/repositories/customer-favorites.repository";

export class AddFavoriteService {
  async execute(customerId: string, menuItemId: string) {
    await customerFavoritesRepository.upsertFavorite(customerId, menuItemId);
  }
}

export const addFavoriteService = new AddFavoriteService();
