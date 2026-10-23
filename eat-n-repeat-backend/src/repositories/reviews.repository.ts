import { prisma } from "@/lib/prisma";

export type ReviewListFilter = {
  rating?: number;
  status?: "visible" | "hidden";
  search?: string;
  page?: number;
  limit?: number;
};

function clampPage(page?: number) {
  const p = Math.floor(Number(page) || 1);
  return p < 1 ? 1 : p;
}

function clampLimit(limit?: number) {
  const l = Math.floor(Number(limit) || 50);
  if (l < 1) return 1;
  if (l > 100) return 100;
  return l;
}

export class ReviewsRepository {
  async create(data: {
    id: string;
    menuItemId: string;
    customerId: string;
    customerName: string;
    rating: number;
    comment: string | null;
    orderId: string | null;
  }) {
    return prisma.menuReview.create({ data });
  }

  async findById(id: string) {
    return prisma.menuReview.findUnique({ where: { id } });
  }

  async findByMenuItemAndCustomer(menuItemId: string, customerId: string) {
    return prisma.menuReview.findUnique({
      where: { menuItemId_customerId: { menuItemId, customerId } },
    });
  }

  async findVisibleByMenuItem(
    menuItemId: string,
    page = 1,
    limit = 50,
  ): Promise<{ rows: Awaited<ReturnType<typeof prisma.menuReview.findMany>>; total: number }> {
    const p = clampPage(page);
    const l = clampLimit(limit);
    const where = { menuItemId, hidden: false };
    const [rows, total] = await Promise.all([
      prisma.menuReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.menuReview.count({ where }),
    ]);
    return { rows, total };
  }

  async findManyVisibleByMenuItemIds(menuItemIds: string[]) {
    if (menuItemIds.length === 0) return [];
    return prisma.menuReview.findMany({
      where: { menuItemId: { in: menuItemIds }, hidden: false },
      select: { menuItemId: true, rating: true, customerId: true },
    });
  }

  async findManyByCustomerId(customerId: string) {
    return prisma.menuReview.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findManyForAdmin(filter: ReviewListFilter): Promise<{
    rows: Awaited<ReturnType<typeof prisma.menuReview.findMany>>;
    total: number;
  }> {
    const p = clampPage(filter.page);
    const l = clampLimit(filter.limit);
    const where: Record<string, unknown> = {};
    if (filter.rating && filter.rating >= 1 && filter.rating <= 5) {
      where.rating = filter.rating;
    }
    if (filter.status === "visible") where.hidden = false;
    if (filter.status === "hidden") where.hidden = true;
    const q = (filter.search ?? "").trim().toLowerCase();

    // No search: single efficient query. With search: JS-side filter so
    // matching is case-insensitive regardless of DB collation (same pattern
    // as the login services), then paginate in memory.
    if (!q) {
      const [rows, total] = await Promise.all([
        prisma.menuReview.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (p - 1) * l,
          take: l,
        }),
        prisma.menuReview.count({ where }),
      ]);
      return { rows, total };
    }

    const candidates = await prisma.menuReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    const matched = candidates.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        (r.comment ?? "").toLowerCase().includes(q) ||
        r.menuItemId.toLowerCase().includes(q),
    );
    return {
      rows: matched.slice((p - 1) * l, (p - 1) * l + l),
      total: matched.length,
    };
  }

  async update(
    id: string,
    data: Partial<{ rating: number; comment: string | null; hidden: boolean; customerName: string }>,
  ) {
    return prisma.menuReview.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return prisma.menuReview.delete({ where: { id } });
  }

  async aggregateByMenuItem(menuItemId: string): Promise<{ average: number; count: number }> {
    const result = await prisma.menuReview.aggregate({
      where: { menuItemId, hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return { average: result._avg.rating ?? 0, count: result._count._all };
  }

  async aggregateMany(menuItemIds: string[]): Promise<Record<string, { average: number; count: number }>> {
    if (menuItemIds.length === 0) return {};
    const groups = await prisma.menuReview.groupBy({
      by: ["menuItemId"],
      where: { menuItemId: { in: menuItemIds }, hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const out: Record<string, { average: number; count: number }> = {};
    for (const g of groups) {
      out[g.menuItemId] = { average: g._avg.rating ?? 0, count: g._count._all };
    }
    return out;
  }

  async adminStats(): Promise<{
    total: number;
    visible: number;
    hidden: number;
    average: number;
    distribution: Record<number, number>;
  }> {
    const [total, visible, avgResult, all] = await Promise.all([
      prisma.menuReview.count(),
      prisma.menuReview.count({ where: { hidden: false } }),
      prisma.menuReview.aggregate({
        where: { hidden: false },
        _avg: { rating: true },
      }),
      prisma.menuReview.findMany({ select: { rating: true } }),
    ]);
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of all) {
      if (r.rating >= 1 && r.rating <= 5) distribution[r.rating] += 1;
    }
    return {
      total,
      visible,
      hidden: total - visible,
      average: avgResult._avg.rating ?? 0,
      distribution,
    };
  }
}

export const reviewsRepository = new ReviewsRepository();
