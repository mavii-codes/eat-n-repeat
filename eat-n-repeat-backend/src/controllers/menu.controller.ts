import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { menuCategorySchema, menuItemSchema } from "@/schema/menu/menu.schema";
import * as service from "@/services/menu/index";

function dbError(res: Response, error: unknown, context: string) {
  const code = (error as { code?: string })?.code;
  if (code === "P2025") return res.status(404).json({ message: "Not found." });
  if (code === "P2003")
    return res.status(400).json({ message: "The selected menu category does not exist." });
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ message: "Internal server error." });
}

export class MenuController {
  // Public — customers browse the menu without logging in.
  async listCategories(_req: Request, res: Response) {
    try {
      const includeArchived = (_req.query.admin as string) === "true";
      const categories = await service.listMenuCategories(includeArchived);
      return res.json({ categories });
    } catch (error) {
      return dbError(res, error, "listing menu categories");
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response) {
    const parsed = menuCategorySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "A category name is required." });
    try {
      const category = await service.createMenuCategory(parsed.data);
      return res.status(201).json({ category });
    } catch (error) {
      return dbError(res, error, "creating menu category");
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response) {
    const parsed = menuCategorySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "A category name is required." });
    try {
      const category = await service.updateMenuCategory(
        req.params.id as string,
        parsed.data,
      );
      return res.json({ category });
    } catch (error) {
      return dbError(res, error, "updating menu category");
    }
  }

  async archiveCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const category = await service.setMenuCategoryArchived(
        req.params.id as string,
        true,
      );
      return res.json({ category });
    } catch (error) {
      return dbError(res, error, "archiving menu category");
    }
  }

  async restoreCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const category = await service.setMenuCategoryArchived(
        req.params.id as string,
        false,
      );
      return res.json({ category });
    } catch (error) {
      return dbError(res, error, "restoring menu category");
    }
  }

  // Public — customers browse the menu without logging in.
  async listItems(req: Request, res: Response) {
    try {
      const includeArchived = (req.query.admin as string) === "true";
      const items = await service.listMenuItems(includeArchived);
      return res.json({ items });
    } catch (error) {
      return dbError(res, error, "listing menu items");
    }
  }

  async createItem(req: AuthenticatedRequest, res: Response) {
    const parsed = menuItemSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Menu item details are invalid." });
    try {
      const item = await service.createMenuItem(parsed.data);
      return res.status(201).json({ item });
    } catch (error) {
      return dbError(res, error, "creating menu item");
    }
  }

  async updateItem(req: AuthenticatedRequest, res: Response) {
    const parsed = menuItemSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Menu item details are invalid." });
    try {
      const item = await service.updateMenuItem(req.params.id as string, parsed.data);
      return res.json({ item });
    } catch (error) {
      return dbError(res, error, "updating menu item");
    }
  }

  async archiveItem(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await service.setMenuItemArchived(req.params.id as string, true);
      return res.json({ item });
    } catch (error) {
      return dbError(res, error, "archiving menu item");
    }
  }

  async restoreItem(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await service.setMenuItemArchived(req.params.id as string, false);
      return res.json({ item });
    } catch (error) {
      return dbError(res, error, "restoring menu item");
    }
  }
}

export const menuController = new MenuController();
