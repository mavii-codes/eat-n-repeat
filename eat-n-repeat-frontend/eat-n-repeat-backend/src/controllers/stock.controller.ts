import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as service from "@/services/stock";
import {
  categorySchema,
  itemSchema,
  stockRequestInputSchema,
  stockRequestStatusSchema,
} from "@/schema/stock/stock.schema";

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

    try {
      const item = await service.createItem(parsed.data);
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
      const item = await service.updateItem(req.params.id as string, parsed.data);
      return res.json({ item });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Stock item not found." });
      }
      if (error.code === "P2003") {
        return res.status(400).json({ message: "The selected stock category does not exist." });
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
}

export const stockController = new StockController();
