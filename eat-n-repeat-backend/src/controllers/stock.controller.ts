import type { Response } from "express";
import { Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { prisma } from "@/lib/prisma";
import * as service from "@/services/stock";
import {
  categorySchema,
  itemSchema,
  stockRequestInputSchema,
  stockRequestStatusSchema,
} from "@/schema/stock/stock.schema";
import {
  adjustSchema,
  movementsQuerySchema,
  setLayerCostSchema,
  stockInSchema,
} from "@/schema/stock/movements.schema";

export class StockController {
  async listCategories(_req: AuthenticatedRequest, res: Response) {
    try {
      const categories = await service.listCategories();
      return res.json({ categories });
    } catch (error) {
      console.error("Error listing categories:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response) {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "A category name is required." });
    }

    try {
      const category = await service.createCategory(parsed.data.name);
      return res.status(201).json({ category });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({ message: "That stock category already exists." });
      }
      console.error("Error creating category:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response) {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "A category name is required." });
    }

    try {
      const category = await service.updateCategory(req.params.id as string, parsed.data.name);
      return res.json({ category });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({ message: "That stock category already exists." });
      }
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Category not found." });
      }
      console.error("Error updating category:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      await service.deleteCategory(req.params.id as string);
      return res.status(204).send();
    } catch (error: any) {
      if (error.code === "P2003") {
        return res.status(409).json({ message: "Remove this category's stock items first." });
      }
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Category not found." });
      }
      console.error("Error deleting category:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async listItems(_req: AuthenticatedRequest, res: Response) {
    try {
      const items = await service.listItems();
      return res.json({ items });
    } catch (error) {
      console.error("Error listing items:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async createItem(req: AuthenticatedRequest, res: Response) {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Stock item details are invalid." });
    }

    const quantity = new Prisma.Decimal((parsed.data.quantity ?? 0).toString());
    if (quantity.greaterThan(0)) {
      return res.status(400).json({
        message: "New items must start at zero balance. Use Stock In to add stock.",
      });
    }

    try {
      // Force zero even if a zero-ish value was supplied; opening stock must
      // flow through Stock In so a cost layer exists.
      const item = await service.createItem({ ...parsed.data, quantity: 0 });
      return res.status(201).json({ item });
    } catch (error: any) {
      if (error.code === "P2003") {
        return res.status(400).json({ message: "The selected stock category does not exist." });
      }
      console.error("Error creating item:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async updateItem(req: AuthenticatedRequest, res: Response) {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Stock item details are invalid." });
    }

    try {
      const userId = req.auth?.userId;
      let actor: { id: string; name: string } | undefined;
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        actor = { id: userId, name: user?.name ?? "Admin" };
      }

      const item = await service.updateItem(req.params.id as string, parsed.data, actor);
      return res.json({ item });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Stock item not found." });
      }
      if (error.code === "P2003") {
        return res.status(400).json({ message: "The selected stock category does not exist." });
      }
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Error updating item:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async deleteItem(req: AuthenticatedRequest, res: Response) {
    try {
      await service.deleteItem(req.params.id as string);
      return res.status(204).send();
    } catch (error: any) {
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Stock item not found." });
      }
      console.error("Error deleting item:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async listRequests(_req: AuthenticatedRequest, res: Response) {
    try {
      const requests = await service.listRequests();
      return res.json({ requests });
    } catch (error) {
      console.error("Error listing requests:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async createRequest(req: AuthenticatedRequest, res: Response) {
    const parsed = stockRequestInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid restock request details." });
    }

    const { ingredientId, ingredientName, currentQuantity, unit, threshold, message } = parsed.data;
    const authReq = req as AuthenticatedRequest & { user?: { id?: string; name?: string } };
    const staffId = (authReq as any).user?.id || authReq.auth?.userId || parsed.data.staffId || "sf-1";
    const staffName = (authReq as any).user?.name || parsed.data.staffName || "Staff";

    try {
      const request = await service.createRequest({
        staffId,
        staffName,
        ingredientId,
        ingredientName,
        currentQuantity,
        unit,
        threshold,
        message,
      });
      return res.status(201).json({ request });
    } catch (error: any) {
      if (error.code === "PENDING_DUPLICATE") {
        return res.status(409).json({ message: "A restock request for this item is already pending Admin review." });
      }
      console.error("Error creating request:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async updateRequestStatus(req: AuthenticatedRequest, res: Response) {
    const parsed = stockRequestStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request status." });
    }

    const { status, adminNote } = parsed.data;

    try {
      const request = await service.updateRequestStatus(req.params.id as string, status, adminNote);
      return res.json({ request });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Stock request not found." });
      }
      console.error("Error updating request status:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async stockIn(req: AuthenticatedRequest, res: Response) {
    const itemId = String(req.params.id ?? "").trim();
    if (!itemId || itemId.length > 64) {
      return res.status(400).json({ message: "Invalid stock item id." });
    }

    const parsed = stockInSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstIssue = issues[0];
      const field = firstIssue?.path[0] != null ? String(firstIssue.path[0]) : undefined;
      const message = firstIssue?.message ?? "Invalid stock-in details.";
      const errors = issues.map((issue) => ({
        field: issue.path[0] != null ? String(issue.path[0]) : "general",
        message: issue.message,
      }));
      return res.status(400).json({
        message,
        field,
        errors,
      });
    }

    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const result = await service.stockIn(itemId, parsed.data, {
        id: userId,
        name: user?.name ?? "Admin",
      });
      return res.status(201).json(result);
    } catch (error: any) {
      if (!error?.status || error.status >= 500) {
        console.error("Error recording stock-in:", error);
      }
      return res.status(error?.status ?? 500).json({
        message: error?.message ?? "Internal server error.",
      });
    }
  }

  async adjust(req: AuthenticatedRequest, res: Response) {
    const itemId = String(req.params.id ?? "").trim();
    if (!itemId || itemId.length > 64) {
      return res.status(400).json({ message: "Invalid stock item id." });
    }

    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstIssue = issues[0];
      const field = firstIssue?.path[0] != null ? String(firstIssue.path[0]) : undefined;
      const message = firstIssue?.message ?? "Invalid adjustment details.";
      const errors = issues.map((issue) => ({
        field: issue.path[0] != null ? String(issue.path[0]) : "general",
        message: issue.message,
      }));
      return res.status(400).json({
        message,
        field,
        errors,
      });
    }

    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const result = await service.adjust(itemId, parsed.data, {
        id: userId,
        name: user?.name ?? "Admin",
      });
      return res.status(201).json(result);
    } catch (error: any) {
      if (!error?.status || error.status >= 500) {
        console.error("Error recording stock adjustment:", error);
      }
      return res.status(error?.status ?? 500).json({
        message: error?.message ?? "Internal server error.",
      });
    }
  }

  async listMovements(req: AuthenticatedRequest, res: Response) {
    const parsed = movementsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstIssue = issues[0];
      const field = firstIssue?.path[0] != null ? String(firstIssue.path[0]) : undefined;
      const message = firstIssue?.message ?? "Invalid movement filters.";
      const errors = issues.map((issue) => ({
        field: issue.path[0] != null ? String(issue.path[0]) : "general",
        message: issue.message,
      }));
      return res.status(400).json({
        message,
        field,
        errors,
      });
    }

    try {
      const result = await service.listMovements(parsed.data);
      return res.json(result);
    } catch (error: any) {
      console.error("Error listing stock movements:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async listItemLayers(req: AuthenticatedRequest, res: Response) {
    const itemId = String(req.params.id ?? "").trim();
    if (!itemId || itemId.length > 64) {
      return res.status(400).json({ message: "Invalid stock item id." });
    }

    try {
      const layers = await service.listItemLayers(itemId);
      return res.json(layers);
    } catch (error: any) {
      console.error("Error listing stock layers:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async setLayerCost(req: AuthenticatedRequest, res: Response) {
    const itemId = String(req.params.id ?? "").trim();
    const layerId = String(req.params.layerId ?? "").trim();
    if (
      !itemId ||
      itemId.length > 64 ||
      !layerId ||
      layerId.length > 64
    ) {
      return res.status(400).json({ message: "Invalid stock item or layer id." });
    }

    const parsed = setLayerCostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Invalid unit cost.",
      });
    }

    try {
      const layer = await service.setLayerCost(itemId, layerId, parsed.data.unitCost);
      return res.json({ success: true, layer });
    } catch (error: any) {
      if (!error?.status || error.status >= 500) {
        console.error("Error setting stock layer cost:", error);
      }
      return res.status(error?.status ?? 500).json({
        message: error?.message ?? "Internal server error.",
      });
    }
  }

  async dashboard(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await service.stockDashboard();
      return res.json(result);
    } catch (error: any) {
      console.error("Error loading stock dashboard:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async consistencyCheck(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await service.runStockConsistencyCheck();
      return res.json(result);
    } catch (error: any) {
      console.error("Error running consistency check:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }

  async syncMenu(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await service.syncAllMenuItemsToStock();
      return res.json(result);
    } catch (error: any) {
      console.error("Error syncing menu to stock:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }
}

export const stockController = new StockController();

