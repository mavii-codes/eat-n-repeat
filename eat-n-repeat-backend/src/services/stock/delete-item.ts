import { prisma } from "@/lib/prisma";
import { stockRepository } from "@/repositories/stock.repository";

export class DeleteItemService {
  async execute(id: string) {
    const linkedMenu = await prisma.menuItem.findUnique({ where: { stockItemId: id } });
    if (linkedMenu) {
      throw Object.assign(
        new Error(`Cannot delete: this stock item is linked to menu item "${linkedMenu.name}". Unlink it from the Menu Item first.`),
        { status: 409 }
      );
    }
    const movementCount = await prisma.stockMovement.count({ where: { stockItemId: id } });
    if (movementCount > 0) {
      throw Object.assign(
        new Error(`Cannot delete: this stock item has ${movementCount} historical movement record(s). Keep it for audit history.`),
        { status: 409 }
      );
    }
    await stockRepository.deleteItem(id);
  }
}

export const deleteItemService = new DeleteItemService();
