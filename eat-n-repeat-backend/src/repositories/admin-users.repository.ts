import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type UserSortField = "name" | "createdAt" | "lastLoginAt";
export type SortDir = "asc" | "desc";

export type ListStaffParams = {
  search: string;
  role?: string;
  status?: string;
  sort: UserSortField;
  dir: SortDir;
  page: number;
  limit: number;
};

export type ListCustomerParams = {
  search: string;
  status?: string;
  sort: UserSortField;
  dir: SortDir;
  page: number;
  limit: number;
};

export type ListActivityParams = {
  action?: string;
  targetType?: string;
  search: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
};

/** Open-unpaid definition shared with the B3 checkout caps. */
const OPEN_UNPAID_STATUSES = ["pending", "pending_payment", "awaiting_payment"] as const;

export class AdminUsersRepository {
  async listStaff(params: ListStaffParams) {
    const q = params.search.trim();
    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
        { email: { contains: q } },
      ];
    }
    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;

    const orderBy = {
      [params.sort]: params.dir,
    } as Prisma.UserOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          status: true,
          archived: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.user.count({ where }),
    ]);
    return { rows, total };
  }

  async findOpenShiftStaffIds(staffIds: string[]): Promise<string[]> {
    if (staffIds.length === 0) return [];
    const rows = await prisma.cashShift.findMany({
      where: { staffId: { in: staffIds }, status: "open" },
      select: { staffId: true },
      distinct: ["staffId"],
    });
    return rows.map((row) => row.staffId);
  }

  async findStaffById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        archived: true,
        mustChangePassword: true,
      },
    });
  }

  async countActiveAdminsExcluding(id: string): Promise<number> {
    return prisma.user.count({
      where: {
        id: { not: id },
        role: "admin",
        status: "active",
        archived: false,
      },
    });
  }

  async hasOpenShift(staffId: string): Promise<boolean> {
    const shift = await prisma.cashShift.findFirst({
      where: { staffId, status: "open" },
      select: { id: true },
    });
    return Boolean(shift);
  }

  async setStaffStatus(id: string, status: string) {
    return prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true },
    });
  }

  async enableStaff(id: string) {
    return prisma.user.update({
      where: { id },
      data: { status: "active", archived: false },
      select: { id: true },
    });
  }

  async setStaffPassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
      select: { id: true },
    });
  }

  async listCustomers(params: ListCustomerParams) {
    const q = params.search.trim();
    const where: Prisma.CustomerWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }
    if (params.status) where.status = params.status;

    const orderBy = {
      [params.sort]: params.dir,
    } as Prisma.CustomerOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.customer.count({ where }),
    ]);
    return { rows, total };
  }

  async countOpenUnpaidOrders(customerIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (customerIds.length === 0) return counts;

    const rows = await prisma.order.findMany({
      where: {
        customerId: { in: customerIds },
        orderMode: "online",
        status: { in: [...OPEN_UNPAID_STATUSES] },
        payments: { none: { status: "PAID" } },
      },
      select: { customerId: true },
    });
    for (const row of rows) {
      if (!row.customerId) continue;
      counts.set(row.customerId, (counts.get(row.customerId) ?? 0) + 1);
    }
    return counts;
  }

  async findCustomerById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, status: true },
    });
  }

  async setCustomerStatus(id: string, status: string) {
    return prisma.customer.update({
      where: { id },
      data: { status },
      select: { id: true },
    });
  }

  async listActivity(params: ListActivityParams) {
    const q = params.search.trim();
    const where: Prisma.UserActivityLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.targetType) where.targetType = params.targetType;
    if (q) {
      where.OR = [
        { actorName: { contains: q } },
        { targetName: { contains: q } },
      ];
    }
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }

    const [rows, total] = await Promise.all([
      prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.userActivityLog.count({ where }),
    ]);
    return { rows, total };
  }
}

export const adminUsersRepository = new AdminUsersRepository();
