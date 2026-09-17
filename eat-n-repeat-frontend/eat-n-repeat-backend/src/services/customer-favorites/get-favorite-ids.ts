import { customerFavoritesRepository } from "@/repositories/customer-favorites.repository";

export class GetFavoriteIdsService {
  async execute(customerId: string): Promise<string[]> {
    const rows = await customerFavoritesRepository.findManyByCustomerId(customerId);
    return rows.map((r) => r.menuItemId);
  }
}

export const getFavoriteIdsService = new GetFavoriteIdsService();
