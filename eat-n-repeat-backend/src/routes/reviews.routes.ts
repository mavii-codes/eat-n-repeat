import { Router } from "express";
import { optionalAuth, requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/requireRole.middleware";
import { reviewsController } from "@/controllers/reviews.controller";

const router = Router();

// Public reads — guests browse ratings/reviews without logging in.
// optionalAuth populates req.auth when a token is present so the response
// can include customer-specific myRating/hasReviewed alongside the GLOBAL
// aggregate and GLOBAL review list.
router.get("/item/:menuItemId", optionalAuth, (req, res) =>
  reviewsController.getItemReviews(req, res),
);

// Customer's own review history.
router.get("/mine", requireRole("customer"), (req, res) =>
  reviewsController.getMine(req, res),
);

// Admin/staff list (all statuses, filters, stats). Read-only for staff;
// hide/unhide/delete stay admin-gated below and in the controller.
router.get("/", requireRole("admin", "head_staff", "staff"), (req, res) =>
  reviewsController.getAdminList(req, res),
);

// Customer writes — one review per customer per menu item (409 on duplicate).
router.post("/", requireRole("customer"), (req, res) =>
  reviewsController.createReview(req, res),
);

// Owner-only edit (service enforces ownership).
router.put("/:id", requireAuth, (req, res) =>
  reviewsController.updateReview(req, res),
);

// Owner or admin/head_staff delete (resolved in the controller).
router.delete("/:id", requireAuth, (req, res) =>
  reviewsController.deleteReview(req, res),
);

// Admin hide/unhide moderation.
router.patch(
  "/:id/visibility",
  requireRole("admin", "head_staff"),
  (req, res) => reviewsController.setVisibility(req, res),
);

export default router;
