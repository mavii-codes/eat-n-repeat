import { Router } from "express";
import { optionalAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { menuController } from "@/controllers/menu.controller";

const router = Router();

// Public reads — customers browse without logging in.
router.get("/categories", (req, res) => menuController.listCategories(req, res));
// optionalAuth: guests get the GLOBAL aggregate; logged-in customers also
// get their own myRating/hasReviewed on each item.
router.get("/items", optionalAuth, (req, res) => menuController.listItems(req, res));

// Writes — staff/admin only (customer JWTs are rejected).
router.post("/categories", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.createCategory(req, res),
);
router.put("/categories/:id", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.updateCategory(req, res),
);
router.post("/categories/:id/archive", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.archiveCategory(req, res),
);
router.post("/categories/:id/restore", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.restoreCategory(req, res),
);

router.post("/items", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.createItem(req, res),
);
router.put("/items/:id", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.updateItem(req, res),
);
router.post("/items/:id/archive", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.archiveItem(req, res),
);
router.post("/items/:id/restore", requireRole(...STAFF_ROLES), (req, res) =>
  menuController.restoreItem(req, res),
);

export default router;
