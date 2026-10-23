import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "@/config/env";
import { adminUsersRepository } from "@/repositories/admin-users.repository";
import {
  adminFlagsRepository,
  type ListFlagsParams,
} from "@/repositories/admin-flags.repository";
import {
  resolveActorName,
  writeActivity,
} from "@/services/admin-users/activity";

const REPORT_REASON_MESSAGE = "A reason is required to flag a customer.";
const OPEN_FLAG_MESSAGE = "This customer already has an open flag.";

const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const FAILED_LOGIN_WINDOW_MS = 60 * 60 * 1000;

/**
 * In-process signal for repeat signups from one connection. Signup IPs are
 * not persisted per customer (and no new table was added for this signal),
 * so a process restart resets the window. That is acceptable for a flag
 * signal; the flag itself is durable once written.
 */
const signupTimesByIp = new Map<string, number[]>();

/**
 * In-process failed sign-in counter, keyed by lowercased email for the
 * customer namespace. A successful sign-in clears the bucket; entries older
 * than one hour are discarded on every read/write.
 */
const failedLoginTimesByEmail = new Map<string, number[]>();

/** Namespace key: the counter only applies to the customer login kind. */
function failedLoginKey(email: string): string {
  return `customer:${email.trim().toLowerCase()}`;
}

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

function pruneWindow(times: number[], now: number, windowMs: number): number[] {
  return times.filter((at) => now - at < windowMs);
}

function mergeFlagMeta(
  existing: Prisma.JsonValue | null,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return {
      ...(existing as Record<string, unknown>),
      ...patch,
    } as Prisma.InputJsonValue;
  }
  return patch as Prisma.InputJsonValue;
}

export type AutoFlagInput = {
  customerId: string;
  customerName: string;
  rule: "signup_ip" | "cancelled_streak" | "failed_logins";
  reason: string;
  meta?: Record<string, unknown>;
};

export class AdminFlagsService {
  /** One open row per customer, enforced here (auto-flags skip silently). */
  private async createAutoFlag(input: AutoFlagInput): Promise<string | null> {
    const existing = await adminFlagsRepository.findOpenByCustomerId(
      input.customerId,
    );
    if (existing) return null;

    const id = `flag-${crypto.randomUUID()}`;
    const meta: Prisma.InputJsonValue = {
      rule: input.rule,
      ...(input.meta ?? {}),
    };
    await adminFlagsRepository.createFlag({
      id,
      customerId: input.customerId,
      status: "open",
      outcome: "pending",
      reason: input.reason,
      flaggedByKind: "system",
      flaggedById: null,
      flaggedByName: null,
      rule: input.rule,
      meta,
    });
    await writeActivity({
      actorId: "system",
      actorName: "System",
      action: "system_customer_flagged",
      targetType: "customer",
      targetId: input.customerId,
      targetName: input.customerName,
      meta: { flagId: id, rule: input.rule, ...(input.meta ?? {}) },
    });
    return id;
  }

  async reportCustomer(customerId: string, actorId: string, rawReason: unknown) {
    const reason =
      typeof rawReason === "string" ? rawReason.trim() : "";
    if (reason.length < 5 || reason.length > 500) {
      throw serviceError(400, REPORT_REASON_MESSAGE);
    }

    const customer = await adminFlagsRepository.findCustomerById(customerId);
    if (!customer) throw serviceError(404, "Customer not found.");

    const existing = await adminFlagsRepository.findOpenByCustomerId(customerId);
    if (existing) throw serviceError(409, OPEN_FLAG_MESSAGE);

    const actorName = await resolveActorName(actorId);
    const id = `flag-${crypto.randomUUID()}`;
    await adminFlagsRepository.createFlag({
      id,
      customerId,
      status: "open",
      outcome: "pending",
      reason,
      flaggedByKind: "staff",
      flaggedById: actorId,
      flaggedByName: actorName,
      rule: "manual",
    });
    await writeActivity({
      actorId,
      actorName,
      action: "customer_reported",
      targetType: "customer",
      targetId: customerId,
      targetName: customer.name,
      meta: { flagId: id, rule: "manual" },
    });

    return { message: "Customer flagged for review." };
  }

  private async decide(
    id: string,
    actorId: string,
    action: "approved" | "dismissed" | "watching",
  ) {
    const flag = await adminFlagsRepository.findById(id);
    if (!flag) throw serviceError(404, "Flag not found.");
    // Decisions apply to open flags only — dismissed rows are read-only
    // history (re-deciding one would silently re-open it and then 409-block
    // future reports for the customer).
    if (flag.status !== "open") throw serviceError(404, "Flag not found.");

    const customer = await adminFlagsRepository.findCustomerById(flag.customerId);
    const actorName = await resolveActorName(actorId);
    const now = new Date();

    const data: Prisma.CustomerFlagUpdateInput =
      action === "dismissed"
        ? {
            status: "dismissed",
            outcome: "dismissed",
            resolvedById: actorId,
            resolvedByName: actorName,
            resolvedAt: now,
          }
        : { status: "open", outcome: action };

    await adminFlagsRepository.updateFlag(id, data);
    await writeActivity({
      actorId,
      actorName,
      action: `flag_${action}`,
      targetType: "customer",
      targetId: flag.customerId,
      targetName: customer?.name ?? null,
      meta: { flagId: id, rule: flag.rule, outcome: action },
    });

    if (action === "approved") return { message: "Flag approved." };
    if (action === "dismissed") return { message: "Flag dismissed." };
    return { message: "Flag set to keep watching." };
  }

  approveFlag(id: string, actorId: string) {
    return this.decide(id, actorId, "approved");
  }

  dismissFlag(id: string, actorId: string) {
    return this.decide(id, actorId, "dismissed");
  }

  watchFlag(id: string, actorId: string) {
    return this.decide(id, actorId, "watching");
  }

  async listFlags(query: ListFlagsParams) {
    const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1);
    const limit = clampInt(query.limit, 1, 100, 20);
    const status =
      query.status === "open" || query.status === "dismissed"
        ? query.status
        : "all";

    const { rows, total } = await adminFlagsRepository.listFlags({
      status,
      outcome: query.outcome?.trim() || undefined,
      search: query.search,
      page,
      limit,
    });

    const customerIds = [...new Set(rows.map((row) => row.customerId))];
    const [customers, openUnpaid] = await Promise.all([
      adminFlagsRepository.findCustomersByIds(customerIds),
      adminUsersRepository.countOpenUnpaidOrders(customerIds),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    return {
      rows: rows.map((row) => {
        const customer = customerById.get(row.customerId) ?? null;
        return {
          id: row.id,
          customerId: row.customerId,
          status: row.status,
          outcome: row.outcome,
          reason: row.reason,
          flaggedByKind: row.flaggedByKind,
          flaggedByName: row.flaggedByName,
          rule: row.rule,
          meta: row.meta,
          flaggedAt: row.flaggedAt.toISOString(),
          resolvedByName: row.resolvedByName,
          resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
          customer: customer
            ? {
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                status: customer.status,
              }
            : null,
          openUnpaidOrders: openUnpaid.get(row.customerId) ?? 0,
        };
      }),
      total,
    };
  }

  async countOpenFlags() {
    return { count: await adminFlagsRepository.countOpen() };
  }

  /**
   * Newest open flag per customer for the admin customer list (additive
   * `openFlag` field on GET /api/admin/users/customers).
   */
  async openFlagsForCustomers(customerIds: string[]) {
    const rows = await adminFlagsRepository.findOpenFlagsForCustomers(customerIds);
    const byCustomer = new Map<
      string,
      { id: string; outcome: string; rule: string | null; flaggedAt: Date }
    >();
    for (const row of rows) {
      if (byCustomer.has(row.customerId)) continue; // newest-first result
      byCustomer.set(row.customerId, {
        id: row.id,
        outcome: row.outcome,
        rule: row.rule,
        flaggedAt: row.flaggedAt,
      });
    }
    return byCustomer;
  }

  /**
   * Keep-watching recheck: a watching flag auto-dismisses once the customer
   * has at most one open unpaid online order (same definition as
   * GET /api/admin/users/customers). Safe to call from order/payment hooks;
   * failures are logged and never break the caller's write.
   */
  async recheckWatchingFlags(customerId: string): Promise<boolean> {
    try {
      const flag = await adminFlagsRepository.findOpenWatchingByCustomerId(
        customerId,
      );
      if (!flag) return false;

      const openUnpaid = await adminUsersRepository.countOpenUnpaidOrders([
        customerId,
      ]);
      const count = openUnpaid.get(customerId) ?? 0;
      if (count > 1) return false;

      const customer = await adminFlagsRepository.findCustomerById(customerId);
      await adminFlagsRepository.updateFlag(flag.id, {
        status: "dismissed",
        outcome: "dismissed",
        resolvedById: null,
        resolvedByName: "System",
        resolvedAt: new Date(),
        meta: mergeFlagMeta(flag.meta, { trigger: "openUnpaid<=1" }),
      });
      await writeActivity({
        actorId: "system",
        actorName: "System",
        action: "flag_auto_dismissed",
        targetType: "customer",
        targetId: customerId,
        targetName: customer?.name ?? null,
        meta: {
          flagId: flag.id,
          trigger: "openUnpaid<=1",
          openUnpaidOrders: count,
        },
      });
      return true;
    } catch (error) {
      console.error("[admin-flags] watching recheck failed:", error);
      return false;
    }
  }

  /** Signup-IP signal: count successful signups per IP in the last 24h. */
  async recordSignupAndMaybeFlag(input: {
    ip?: string | null;
    customerId: string;
    customerName: string;
  }): Promise<void> {
    try {
      const ip = input.ip?.trim();
      if (!ip) return;

      const now = Date.now();
      const times = pruneWindow(
        signupTimesByIp.get(ip) ?? [],
        now,
        SIGNUP_WINDOW_MS,
      );
      times.push(now);
      signupTimesByIp.set(ip, times);

      const threshold = Math.max(1, env.flags.signupPerIp);
      if (times.length < threshold) return;

      await this.createAutoFlag({
        customerId: input.customerId,
        customerName: input.customerName,
        rule: "signup_ip",
        reason:
          "Three or more accounts signed up from the same connection within 24 hours.",
        meta: {
          ip,
          signups24h: times.length,
          threshold,
        },
      });
    } catch (error) {
      console.error("[admin-flags] signup-IP check failed:", error);
    }
  }

  /** Failed sign-in signal: 5 failures per email in a rolling hour. */
  async recordFailedLoginAttempt(input: {
    email: string;
    customerId?: string | null;
    customerName?: string | null;
  }): Promise<void> {
    try {
      const emailKey = input.email.trim().toLowerCase();
      if (!emailKey) return;
      const key = failedLoginKey(emailKey);

      const now = Date.now();
      const times = pruneWindow(
        failedLoginTimesByEmail.get(key) ?? [],
        now,
        FAILED_LOGIN_WINDOW_MS,
      );
      times.push(now);
      failedLoginTimesByEmail.set(key, times);

      if (!input.customerId) return;
      const threshold = Math.max(1, env.flags.failedLogins);
      if (times.length < threshold) return;

      await this.createAutoFlag({
        customerId: input.customerId,
        customerName: input.customerName?.trim() || "Customer",
        rule: "failed_logins",
        reason: "Five failed sign-in attempts in the last hour.",
        meta: {
          email: emailKey,
          failures: times.length,
          threshold,
          windowMinutes: 60,
        },
      });
    } catch (error) {
      console.error("[admin-flags] failed-login check failed:", error);
    }
  }

  clearFailedLoginAttempts(email: string): void {
    failedLoginTimesByEmail.delete(failedLoginKey(email));
  }

  /**
   * Cancelled-order signal: consecutive online cancellations without a PAID
   * payment, newest-first. Stops at the first non-cancelled order or a
   * cancelled order that does have a PAID payment (same payment truth used
   * by the B3 checkout caps). Then rechecks any watching flag.
   */
  async maybeFlagCancelledStreak(customerId: string): Promise<void> {
    try {
      const orders =
        await adminFlagsRepository.findOrdersForCancelledStreak(customerId);

      let streak = 0;
      for (const order of orders) {
        if (order.status !== "cancelled") break;
        const paid = order.payments.some(
          (payment) => String(payment.status).toUpperCase() === "PAID",
        );
        if (paid) break;
        streak += 1;
      }

      const threshold = Math.max(1, env.flags.cancelledStreak);
      if (streak >= threshold) {
        const customer = await adminFlagsRepository.findCustomerById(customerId);
        await this.createAutoFlag({
          customerId,
          customerName: customer?.name ?? "Customer",
          rule: "cancelled_streak",
          reason: "Three consecutive cancelled orders without a completed payment.",
          meta: { streak, threshold },
        });
      }

      await this.recheckWatchingFlags(customerId);
    } catch (error) {
      console.error("[admin-flags] cancelled-streak check failed:", error);
    }
  }
}

export const adminFlagsService = new AdminFlagsService();

/**
 * Standalone handle for the keep-watching recheck, so order/payment hooks can
 * import it directly instead of going through the singleton.
 */
export function recheckWatchingFlags(customerId: string): Promise<boolean> {
  return adminFlagsService.recheckWatchingFlags(customerId);
}
