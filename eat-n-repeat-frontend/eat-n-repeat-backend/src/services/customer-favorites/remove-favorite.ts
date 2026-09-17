import { customerFavoritesRepository } from "@/repositories/customer-favorites.repository";

export class RemoveFavoriteService {
  async execute(customerId: string, menuItemId: string) {
    await customerFavoritesRepository.deleteFavorite(customerId, menuItemId);
  }
}

export const removeFavoriteService = new RemoveFavoriteService();
