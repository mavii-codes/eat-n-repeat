import { Prisma } from "@prisma/client";
import { stockMovementsRepository } from "@/repositories/stock-movements.repository";
import type { MovementsQuery } from "@/schema/stock/movements.schema";
import { serializeMovement } from "./movement-helpers";

export class ListMovementsService {
  async execute(query: MovementsQuery) {
    const where: Prisma.StockMovementWhereInput = {};

    if (query.itemId) where.stockItemId = query.itemId;
    if (query.type && query.type.length > 0) where.type = { in: query.type };

    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to);
      where.createdAt = createdAt;
    }

    if (query.staffId) where.createdById = query.staffId;
    if (query.search) where.itemName = { contains: query.search };

    const skip = (query.page - 1) * query.limit;

    const [total, rows] = await Promise.all([
      stockMovementsRepository.countMovements(where),
      stockMovementsRepository.findManyMovements(where, { skip, take: query.limit }),
    ]);

    return {
      movements: rows.map(serializeMovement),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
}

export const listMovementsService = new ListMovementsService();
