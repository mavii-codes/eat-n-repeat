import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole, STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { stockController } from "@/controllers/stock.controller";

const router = Router();

router.use(requireAuth);

router.get("/categories", requireRole(...STAFF_ROLES), (req, res) =>
  stockController.listCategories(req, res),
);
// Category writes are admin-only (staff inventory reads stay authenticated).
router.post("/categories", requireRole("admin"), (req, res) =>
  stockController.createCategory(req, res),
);
router.put("/categories/:id", requireRole("admin"), (req, res) =>
  stockController.updateCategory(req, res),
);
router.delete("/categories/:id", requireRole("admin"), (req, res) =>
  stockController.deleteCategory(req, res),
);

router.get("/items", requireRole(...STAFF_ROLES), (req, res) =>
  stockController.listItems(req, res),
);
router.post("/items", requireRole("admin"), (req, res) => stockController.createItem(req, res));
router.put("/items/:id", requireRole("admin"), (req, res) => stockController.updateItem(req, res));
router.delete("/items/:id", requireRole("admin"), (req, res) => stockController.deleteItem(req, res));

// Phase A admin inventory: stock-in, adjustments, movement history, dashboard.
router.post("/items/:id/stock-in", requireRole("admin"), (req, res) =>
  stockController.stockIn(req, res),
);
router.post("/items/:id/adjust", requireRole("admin"), (req, res) =>
  stockController.adjust(req, res),
);
// Phase B: FIFO cost layers for one item (admin-only, same gate as movements).
router.get("/items/:id/layers", requireRole("admin"), (req, res) =>
  stockController.listItemLayers(req, res),
);
// One-time cost capture for an uncosted opening-balance layer.
router.patch("/items/:id/layers/:layerId/cost", requireRole("admin"), (req, res) =>
  stockController.setLayerCost(req, res),
);
router.get("/movements", requireRole("admin"), (req, res) =>
  stockController.listMovements(req, res),
);
router.get("/dashboard", requireRole("admin"), (req, res) =>
  stockController.dashboard(req, res),
);
router.get("/consistency-check", requireRole("admin"), (req, res) =>
  stockController.consistencyCheck(req, res),
);
router.post("/sync-menu", requireRole("admin"), (req, res) =>
  stockController.syncMenu(req, res),
);


// Stock requests: staff submit/read; status transitions carry adminNote and
// are admin-only.
router.get("/requests", requireRole(...STAFF_ROLES), (req, res) =>
  stockController.listRequests(req, res),
);
router.post("/requests", requireRole(...STAFF_ROLES), (req, res) =>
  stockController.createRequest(req, res),
);
router.patch("/requests/:id/status", requireRole("admin"), (req, res) =>
  stockController.updateRequestStatus(req, res),
);

export default router;
