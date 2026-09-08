import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { customerFavoritesController } from "@/controllers/customer-favorites.controller";

const router = Router();

router.get("/", requireAuth, (req, res) => customerFavoritesController.getFavorites(req, res));
router.post("/", requireAuth, (req, res) => customerFavoritesController.addFavorite(req, res));
router.delete("/:id", requireAuth, (req, res) => customerFavoritesController.removeFavorite(req, res));

export default router;
