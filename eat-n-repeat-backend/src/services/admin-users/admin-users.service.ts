import { hashPassword } from "@/lib/bcrypt";
import { revokeAllForUser } from "@/middleware/security/token-revocations";
import {
  adminUsersRepository,
  type SortDir,
  type UserSortField,
} from "@/repositories/admin-users.repository";
import { adminFlagsService } from "@/services/admin-flags";
import { writeActivity } from "./activity";
import { generateTemporaryPassword } from "./temp-password";

function serviceError(statusCode: number, message: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeSort(value: unknown): UserSortField {
  return value === "name" || value === "createdAt" || value === "lastLoginAt"
    ? value
    : "createdAt";
}

function normalizeDir(value: unknown): SortDir {
  return value === "asc" || value === "desc" ? value : "desc";
}

/**
 * Accepts a full ISO timestamp or a plain YYYY-MM-DD date. Date-only `to`
 * bounds are widened to the end of that UTC day so "to=2026-10-22" includes
 * the whole day.
 */
function parseDateBoundary(value: unknown, endOfDay: boolean): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const raw = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = new Date(
    dateOnly ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : raw,
  );
  if (Number.isNaN(parsed.getTime())) {
    throw serviceError(400, "Invalid date filter.");
  }
  return parsed;
}

export type StaffListQuery = {
  search?: string;
  role?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
};

export type CustomerListQuery = {
  search?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
};

export type ActivityListQuery = {
  action?: string;
  targetType?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export class AdminUsersService {
  async listStaff(query: StaffListQuery) {
    const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);
    const limit = clampInt(query.limit, 1, 100, 20);
    const { rows, total } = await adminUsersRepository.listStaff({
      search: (query.search ?? "").toString(),
      role: query.role?.trim() || undefined,
      status: query.status?.trim() || undefined,
      sort: normalizeSort(query.sort),
      dir: normalizeDir(query.dir),
      page,
      limit,
    });

    const openShiftIds = await adminUsersRepository.findOpenShiftStaffIds(
      rows.map((row) => row.id),
    );
    const openShiftSet = new Set(openShiftIds);

    return {
      rows: rows.map((row) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        archived: row.archived,
        lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        hasOpenShift: openShiftSet.has(row.id),
      })),
      total,
    };
  }

  async listCustomers(query: CustomerListQuery) {
    const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);
    const limit = clampInt(query.limit, 1, 100, 20);
    const { rows, total } = await adminUsersRepository.listCustomers({
      search: (query.search ?? "").toString(),
      status: query.status?.trim() || undefined,
      sort: normalizeSort(query.sort),
      dir: normalizeDir(query.dir),
      page,
      limit,
    });

    const customerIds = rows.map((row) => row.id);
    const [openUnpaid, openFlags] = await Promise.all([
      adminUsersRepository.countOpenUnpaidOrders(customerIds),
      adminFlagsService.openFlagsForCustomers(customerIds),
    ]);

    return {
      rows: rows.map((row) => {
        const flag = openFlags.get(row.id);
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          status: row.status,
          lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          openUnpaidOrders: openUnpaid.get(row.id) ?? 0,
          // Phase 3 (additive): newest open flag for the review queue.
          openFlag: flag
            ? {
                id: flag.id,
                outcome: flag.outcome,
                rule: flag.rule,
                flaggedAt: flag.flaggedAt.toISOString(),
              }
            : null,
        };
      }),
      total,
    };
  }

  async listActivity(query: ActivityListQuery) {
    const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);
    const limit = clampInt(query.limit, 1, 100, 20);
    const from = parseDateBoundary(query.from, false);
    const to = parseDateBoundary(query.to, true);
    if (from && to && from.getTime() > to.getTime()) {
      return { rows: [], total: 0 };
    }

    const { rows, total } = await adminUsersRepository.listActivity({
      action: query.action?.trim() || undefined,
      targetType: query.targetType?.trim() || undefined,
      search: (query.search ?? "").toString(),
      from,
      to,
      page,
      limit,
    });

    return {
      rows: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorName: row.actorName,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        targetName: row.targetName,
        meta: row.meta,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  async disableStaff(id: string, actorId: string) {
    const target = await adminUsersRepository.findStaffById(id);
    if (!target) throw serviceError(404, "Staff account not found.");

    // Never lock the café out of its admin surface.
    if (target.role === "admin" && target.status === "active" && !target.archived) {
      const otherActiveAdmins =
        await adminUsersRepository.countActiveAdminsExcluding(id);
      if (otherActiveAdmins === 0) {
        throw serviceError(
          409,
          "At least one active admin account is required.",
        );
      }
    }

    if (await adminUsersRepository.hasOpenShift(id)) {
      throw serviceError(409, "Close the open shift first.");
    }

    await adminUsersRepository.setStaffStatus(id, "disabled");
    revokeAllForUser(id);
    await writeActivity({
      actorId,
      action: "staff_disabled",
      targetType: "staff",
      targetId: id,
      targetName: target.name,
      meta: { status: "disabled", role: target.role },
    });

    return { message: "Staff account disabled." };
  }

  async enableStaff(id: string, actorId: string) {
    const target = await adminUsersRepository.findStaffById(id);
    if (!target) throw serviceError(404, "Staff account not found.");

    await adminUsersRepository.enableStaff(id);
    // Deliberately no revocation rollback: previously revoked tokens stay
    // revoked; the user signs in again to get a fresh token.
    await writeActivity({
      actorId,
      action: "staff_enabled",
      targetType: "staff",
      targetId: id,
      targetName: target.name,
      meta: { status: "active", role: target.role },
    });

    return { message: "Staff account enabled." };
  }

  async resetStaffPassword(id: string, actorId: string) {
    const target = await adminUsersRepository.findStaffById(id);
    if (!target) throw serviceError(404, "Staff account not found.");

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    await adminUsersRepository.setStaffPassword(id, passwordHash);
    revokeAllForUser(id);

    // Never log the generated password or any hash.
    await writeActivity({
      actorId,
      action: "staff_password_reset",
      targetType: "staff",
      targetId: id,
      targetName: target.name,
      meta: { mustChangePassword: true },
    });

    return {
      tempPassword,
      message: "Temporary password generated.",
    };
  }

  async disableCustomer(id: string, actorId: string) {
    const target = await adminUsersRepository.findCustomerById(id);
    if (!target) throw serviceError(404, "Customer not found.");

    await adminUsersRepository.setCustomerStatus(id, "disabled");
    revokeAllForUser(id);
    await writeActivity({
      actorId,
      action: "customer_disabled",
      targetType: "customer",
      targetId: id,
      targetName: target.name,
      meta: { status: "disabled" },
    });

    return { message: "Customer account disabled." };
  }

  async enableCustomer(id: string, actorId: string) {
    const target = await adminUsersRepository.findCustomerById(id);
    if (!target) throw serviceError(404, "Customer not found.");

    await adminUsersRepository.setCustomerStatus(id, "active");
    await writeActivity({
      actorId,
      action: "customer_enabled",
      targetType: "customer",
      targetId: id,
      targetName: target.name,
      meta: { status: "active" },
    });

    return { message: "Customer account enabled." };
  }
}

export const adminUsersService = new AdminUsersService();
