import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ListFlagsParams = {
  status?: "open" | "dismissed" | "all";
  outcome?: string;
  search: string;
  page: number;
  limit: number;
};

export type CreateFlagInput = {
  id: string;
  customerId: string;
  status?: string;
  outcome?: string;
  reason: string;
  flaggedByKind: "staff" | "system";
  flaggedById?: string | null;
  flaggedByName?: string | null;
  rule?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

const CUSTOMER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
} as const;

export class AdminFlagsRepository {
  findCustomerById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      select: CUSTOMER_PUBLIC_SELECT,
    });
  }

  findCustomersByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.customer.findMany({
      where: { id: { in: ids } },
      select: CUSTOMER_PUBLIC_SELECT,
    });
  }

  findById(id: string) {
    return prisma.customerFlag.findUnique({ where: { id } });
  }

  findOpenByCustomerId(customerId: string) {
    return prisma.customerFlag.findFirst({
      where: { customerId, status: "open" },
      orderBy: { flaggedAt: "desc" },
    });
  }

  findOpenWatchingByCustomerId(customerId: string) {
    return prisma.customerFlag.findFirst({
      where: { customerId, status: "open", outcome: "watching" },
      orderBy: { flaggedAt: "desc" },
    });
  }

  findOpenFlagsForCustomers(customerIds: string[]) {
    if (customerIds.length === 0) return Promise.resolve([]);
    return prisma.customerFlag.findMany({
      where: { customerId: { in: customerIds }, status: "open" },
      orderBy: { flaggedAt: "desc" },
      select: {
        id: true,
        customerId: true,
        outcome: true,
        rule: true,
        flaggedAt: true,
      },
    });
  }

  createFlag(input: CreateFlagInput) {
    return prisma.customerFlag.create({
      data: {
        id: input.id,
        customerId: input.customerId,
        status: input.status ?? "open",
        outcome: input.outcome ?? "pending",
        reason: input.reason,
        flaggedByKind: input.flaggedByKind,
        flaggedById: input.flaggedById ?? null,
        flaggedByName: input.flaggedByName ?? null,
        rule: input.rule ?? null,
        ...(input.meta == null ? {} : { meta: input.meta }),
      },
    });
  }

  updateFlag(id: string, data: Prisma.CustomerFlagUpdateInput) {
    return prisma.customerFlag.update({ where: { id }, data });
  }

  async countOpen(): Promise<number> {
    return prisma.customerFlag.count({ where: { status: "open" } });
  }

  async listFlags(params: ListFlagsParams) {
    const where: Prisma.CustomerFlagWhereInput = {};
    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.outcome) where.outcome = params.outcome;

    const q = params.search.trim();
    if (q) {
      const customerMatches = await prisma.customer.findMany({
        where: {
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        },
        select: { id: true },
        take: 500,
      });
      where.OR = [
        { reason: { contains: q } },
        { customerId: { in: customerMatches.map((row) => row.id) } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.customerFlag.findMany({
        where,
        orderBy: { flaggedAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.customerFlag.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Newest-first online orders for the consecutive-cancellation signal.
   * Payment status is included so the service can apply the same
   * "cancelled without a PAID payment" rule used by the B3 checkout caps.
   */
  findOrdersForCancelledStreak(customerId: string) {
    return prisma.order.findMany({
      where: { customerId, orderMode: "online" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        payments: { select: { status: true } },
      },
    });
  }
}

export const adminFlagsRepository = new AdminFlagsRepository();
