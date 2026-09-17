import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import { stockController } from "@/controllers/stock.controller";

const router = Router();

router.use(requireAuth);

router.get("/categories", (req, res) => stockController.listCategories(req, res));
router.post("/categories", (req, res) => stockController.createCategory(req, res));
router.put("/categories/:id", (req, res) => stockController.updateCategory(req, res));
router.delete("/categories/:id", (req, res) => stockController.deleteCategory(req, res));

router.get("/items", (req, res) => stockController.listItems(req, res));
router.post("/items", (req, res) => stockController.createItem(req, res));
router.put("/items/:id", (req, res) => stockController.updateItem(req, res));
router.delete("/items/:id", (req, res) => stockController.deleteItem(req, res));

router.get("/requests", (req, res) => stockController.listRequests(req, res));
router.post("/requests", (req, res) => stockController.createRequest(req, res));
router.patch("/requests/:id/status", (req, res) => stockController.updateRequestStatus(req, res));

export default router;
