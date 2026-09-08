import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { getFavoriteIdsService, addFavoriteService, removeFavoriteService } from "@/services/customer-favorites";

export class CustomerFavoritesController {
  async getFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      const favoriteIds = await getFavoriteIdsService.execute(customerId);
      res.json(favoriteIds);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async addFavorite(req: AuthenticatedRequest, res: Response) {
    const { menuItemId } = req.body;
    const customerId = req.auth!.userId;

    if (!menuItemId) {
      res.status(400).json({ error: "Menu item ID is required" });
      return;
    }

    try {
      await addFavoriteService.execute(customerId, menuItemId);
      res.status(201).json({ success: true, message: "Favorite added" });
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async removeFavorite(req: AuthenticatedRequest, res: Response) {
    const menuItemId = req.params.id as string;
    const customerId = req.auth!.userId;

    try {
      await removeFavoriteService.execute(customerId, menuItemId);
      res.json({ success: true, message: "Favorite removed" });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const customerFavoritesController = new CustomerFavoritesController();
