import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { menuController } from "@/controllers/menu.controller";

const router = Router();

// Public reads — customers browse without logging in.
router.get("/categories", (req, res) => menuController.listCategories(req, res));
router.get("/items", (req, res) => menuController.listItems(req, res));

// Writes — any authenticated staff/admin (same rule as /stock).
router.post("/categories", requireAuth, (req, res) =>
  menuController.createCategory(req, res),
);
router.put("/categories/:id", requireAuth, (req, res) =>
  menuController.updateCategory(req, res),
);
router.post("/categories/:id/archive", requireAuth, (req, res) =>
  menuController.archiveCategory(req, res),
);
router.post("/categories/:id/restore", requireAuth, (req, res) =>
  menuController.restoreCategory(req, res),
);

router.post("/items", requireAuth, (req, res) => menuController.createItem(req, res));
router.put("/items/:id", requireAuth, (req, res) =>
  menuController.updateItem(req, res),
);
router.post("/items/:id/archive", requireAuth, (req, res) =>
  menuController.archiveItem(req, res),
);
router.post("/items/:id/restore", requireAuth, (req, res) =>
  menuController.restoreItem(req, res),
);

export default router;
