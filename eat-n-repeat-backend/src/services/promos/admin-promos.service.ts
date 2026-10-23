import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { writeActivity } from "@/services/admin-users/activity";
import {
  PromoCodeRow,
  normalizePromoCode,
} from "./promos.service";

/**
 * Admin-only promo management: list, create, edit, pause/activate, delete,
 * redemption drill-down. Every mutation is written to the Phase 2 activity
 * log with who/when via writeActivity. 409-class rules from the spec:
 * - a code with redemptions can never be hard-deleted (pause instead);
 * - type/value become immutable once a code has been used.
 */

export class AdminPromoError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.status = status;
  }
}

export type PromoStatusLabel = "ACTIVE" | "PAUSED" | "SCHEDULED" | "EXPIRED" | "USED_UP";

export function deriveStatus(promo: PromoCodeRow, now = new Date()): PromoStatusLabel {
  if (!promo.active) return "PAUSED";
  if (now.getTime() < promo.startsAt.getTime()) return "SCHEDULED";
  if (promo.endsAt && now.getTime() > promo.endsAt.getTime()) return "EXPIRED";
  if (promo.totalLimit != null && promo.usageCount >= promo.totalLimit) return "USED_UP";
  return "ACTIVE";
}

const PAGE_MAX = 100;

function clampPaging(page?: number, limit?: number, fallbackLimit = 10) {
  const p = Number.isFinite(page) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
  const l = Number.isFinite(limit) && Number(limit) >= 1 ? Math.min(Math.floor(Number(limit)), PAGE_MAX) : fallbackLimit;
  return { page: p, limit: l, skip: (p - 1) * l };
}

function toFixed2(v: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(v).toFixed(2);
}

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** JSON-safe row shape consumed verbatim by the admin frontend. */
function serializePromo(promo: PromoCodeRow, totalDiscounted: Prisma.Decimal | number | string) {
  return {
    id: promo.id,
    code: promo.code,
    description: promo.description,
    type: promo.type,
    value: toFixed2(promo.value),
    max_discount: promo.maxDiscount != null ? toFixed2(promo.maxDiscount) : null,
    min_order: toFixed2(promo.minOrder),
    starts_at: promo.startsAt.toISOString(),
    ends_at: isoOrNull(promo.endsAt),
    total_limit: promo.totalLimit,
    per_customer_limit_once: promo.oncePerCustomer,
    audience: promo.audience,
    channel: promo.channel,
    active: promo.active,
    usage_count: promo.usageCount,
    created_by: promo.createdBy,
    created_at: promo.createdAt.toISOString(),
    updated_at: promo.updatedAt.toISOString(),
    status: deriveStatus(promo),
    total_discounted: toFixed2(totalDiscounted),
  };
}

function buildStatusWhere(status?: string): { promo: Prisma.PromoCodeWhereInput } {
  const now = new Date();
  switch ((status ?? "").toUpperCase()) {
    case "PAUSED":
      return { promo: { active: false } };
    case "SCHEDULED":
      return { promo: { active: true, startsAt: { gt: now } } };
    case "EXPIRED":
      return { promo: { active: true, endsAt: { lte: now } } };
    case "USED_UP":
      return { promo: { active: true, totalLimit: { not: null } } };
    case "ACTIVE":
      return {
        promo: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      };
    default:
      return { promo: {} };
  }
}

export async function listPromos(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, skip } = clampPaging(params.page, params.limit);
  const { promo: promoWhere } = buildStatusWhere(params.status);
  const search = normalizePromoCode(params.search);

  const where: Prisma.PromoCodeWhereInput = {
    ...promoWhere,
    ...(search
      ? { OR: [{ code: { contains: search } }, { description: { contains: params.search ?? undefined } }] }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      orderBy: [
        { active: "desc" },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.promoCode.count({ where }),
  ]);

  // Sum of non-released discount money per code, for the totals column.
  const sums = rows.length
    ? await prisma.promoRedemption.groupBy({
        by: ["promoId"],
        where: { promoId: { in: rows.map((r) => r.id) }, status: { in: ["RESERVED", "APPLIED"] } },
        _sum: { discountAmount: true },
      })
    : [];
  const sumByPromo = new Map(
    sums.map((s) => [s.promoId, s._sum.discountAmount ?? new Prisma.Decimal(0)]),
  );

  return {
    rows: rows.map((r) =>
      serializePromo(r, sumByPromo.get(r.id) ?? new Prisma.Decimal(0)),
    ),
    total,
  };
}

function parseDateOrThrow(value: string | null | undefined, label: string): Date | null {
  if (value == null || value === "") return label === "starts_at" ? null : null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AdminPromoError(`${label === "starts_at" ? "Start date" : "End date"} is invalid.`);
  }
  return d;
}

function validateMoneyRules(input: {
  type: string;
  value: number;
  max_discount?: number | null;
  min_order?: number;
  total_limit?: number | null;
}) {
  if (String(input.type).toUpperCase() === "PERCENT" && input.value > 100) {
    throw new AdminPromoError("Percent value must be 100 or less.");
  }
  if (input.max_discount != null && String(input.type).toUpperCase() !== "PERCENT") {
    throw new AdminPromoError("Max discount applies only to percent codes.");
  }
  if (input.min_order != null && input.min_order < 0) {
    throw new AdminPromoError("Minimum order cannot be negative.");
  }
}

export async function createPromo(input: {
  code: string;
  description?: string | null;
  type: string;
  value: number;
  max_discount?: number | null;
  min_order?: number;
  starts_at: string;
  ends_at?: string | null;
  total_limit?: number | null;
  per_customer_limit_once?: boolean;
  audience?: string;
  channel?: string;
  active?: boolean;
}, actorId: string) {
  const code = normalizePromoCode(input.code);
  const startsAt = parseDateOrThrow(input.starts_at ?? "", "starts_at");
  const endsAt = parseDateOrThrow(input.ends_at, "ends_at");

  let startsEpoch = new Date();
  if (startsAt) {
    startsEpoch = startsAt;
  } else {
    // starts_at required for create.
    const forced = parseDateOrThrow(input.starts_at, "starts_at");
    if (!forced) throw new AdminPromoError("Start date is required.");
    startsEpoch = forced;
  }
  if (endsAt && endsAt.getTime() <= startsEpoch.getTime()) {
    throw new AdminPromoError("End date must be after the start date.");
  }
  validateMoneyRules(input);

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    throw new AdminPromoError("This code already exists", 409);
  }

  const promo = await prisma.promoCode.create({
    data: {
      id: `promo-${uuidv4()}`,
      code,
      description: input.description?.slice(0, 500) || null,
      type: String(input.type).toUpperCase(),
      value: toFixed2(input.value),
      maxDiscount: input.max_discount != null ? toFixed2(input.max_discount) : null,
      minOrder: toFixed2(input.min_order ?? 0),
      startsAt: startsEpoch,
      endsAt,
      totalLimit: input.total_limit ?? null,
      oncePerCustomer: Boolean(input.per_customer_limit_once),
      audience: String(input.audience ?? "EVERYONE").toUpperCase(),
      channel: String(input.channel ?? "BOTH").toUpperCase(),
      active: input.active ?? true,
      createdBy: actorId || null,
    },
  });

  await writeActivity({
    actorId,
    action: "promo_created",
    targetType: "promo",
    targetId: promo.id,
    targetName: promo.code,
    meta: { code: promo.code, type: promo.type },
  });

  return serializePromo(promo, new Prisma.Decimal(0));
}

export async function updatePromo(id: string, patch: Record<string, unknown>, actorId: string) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AdminPromoError("This code doesn't exist", 404);

  const data: Prisma.PromoCodeUpdateInput = {};
  const changed: string[] = [];

  const pickNumber = (v: unknown): number | undefined =>
    v == null || v === "" ? undefined : Number(v);

  // Immutable-when-used: type and value lock forever once a code has any
  // redemption (create a new code instead). Dates/limits/audience stay live.
  const redemptionCount = await prisma.promoRedemption.count({ where: { promoId: id } });
  const wantsType = patch.type !== undefined && String(patch.type).toUpperCase() !== promo.type;
  const wantsValue = patch.value !== undefined && new Prisma.Decimal(String(patch.value)).eq(promo.value) === false;
  if (redemptionCount > 0 && (wantsType || wantsValue)) {
    throw new AdminPromoError(
      "This code has been used and its type or value can't be changed. Create a new code instead.",
      409,
    );
  }

  if (patch.description !== undefined) {
    data.description = patch.description == null || patch.description === "" ? null : String(patch.description).slice(0, 500);
    changed.push("description");
  }
  if (wantsType) {
    data.type = String(patch.type).toUpperCase();
    changed.push("type");
  }
  if (wantsValue) {
    const v = pickNumber(patch.value)!;
    if (!Number.isFinite(v) || v <= 0) throw new AdminPromoError("Value must be greater than 0.");
    data.value = toFixed2(v);
    if (promo.type === "PERCENT" && v > 100) {
      throw new AdminPromoError("Percent value must be 100 or less.");
    }
    changed.push("value");
  }
  if (patch.max_discount !== undefined) {
    const effectiveType = data.type ?? promo.type;
    if (patch.max_discount != null && effectiveType !== "PERCENT") {
      throw new AdminPromoError("Max discount applies only to percent codes.");
    }
    data.maxDiscount =
      patch.max_discount == null || patch.max_discount === "" ? null : toFixed2(Number(patch.max_discount));
    changed.push("max_discount");
  }
  if (patch.min_order !== undefined) {
    const v = pickNumber(patch.min_order) ?? 0;
    if (v < 0) throw new AdminPromoError("Minimum order cannot be negative.");
    data.minOrder = toFixed2(v);
    changed.push("min_order");
  }
  let newStartsAt = promo.startsAt;
  if (patch.starts_at !== undefined) {
    const d = parseDateOrThrow(String(patch.starts_at), "starts_at");
    if (!d) throw new AdminPromoError("Start date is required.");
    newStartsAt = d;
    data.startsAt = d;
    changed.push("starts_at");
  }
  if (patch.ends_at !== undefined) {
    const d = parseDateOrThrow(patch.ends_at as string | null, "ends_at");
    if (d && d.getTime() <= newStartsAt.getTime()) {
      throw new AdminPromoError("End date must be after the start date.");
    }
    data.endsAt = d;
    changed.push("ends_at");
  }
  if (patch.total_limit !== undefined) {
    const v = patch.total_limit == null ? null : Number(patch.total_limit);
    if (v != null && (!Number.isInteger(v) || v < 1)) {
      throw new AdminPromoError("Total limit must be a whole number of 1 or more.");
    }
    data.totalLimit = v;
    changed.push("total_limit");
  }
  if (patch.per_customer_limit_once !== undefined) {
    data.oncePerCustomer = Boolean(patch.per_customer_limit_once);
    changed.push("per_customer_limit_once");
  }
  if (patch.audience !== undefined) {
    data.audience = String(patch.audience).toUpperCase();
    changed.push("audience");
  }
  if (patch.channel !== undefined) {
    data.channel = String(patch.channel).toUpperCase();
    changed.push("channel");
  }
  if (patch.active !== undefined) {
    data.active = Boolean(patch.active);
    changed.push("active");
  }

  if (Object.keys(data).length === 0) {
    return serializePromo(promo, new Prisma.Decimal(0));
  }

  const updated = await prisma.promoCode.update({ where: { id }, data });

  await writeActivity({
    actorId,
    action: "promo_updated",
    targetType: "promo",
    targetId: updated.id,
    targetName: updated.code,
    meta: { code: updated.code, fields: changed },
  });

  const sum = new Prisma.Decimal(0);
  return serializePromo(updated, sum);
}

export async function pausePromo(id: string, actorId: string) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AdminPromoError("This code doesn't exist", 404);
  const updated = await prisma.promoCode.update({ where: { id }, data: { active: false } });
  await writeActivity({
    actorId,
    action: "promo_paused",
    targetType: "promo",
    targetId: updated.id,
    targetName: updated.code,
    meta: { code: updated.code },
  });
  return serializePromo(updated, new Prisma.Decimal(0));
}

export async function activatePromo(id: string, actorId: string) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AdminPromoError("This code doesn't exist", 404);
  const updated = await prisma.promoCode.update({ where: { id }, data: { active: true } });
  await writeActivity({
    actorId,
    action: "promo_activated",
    targetType: "promo",
    targetId: updated.id,
    targetName: updated.code,
    meta: { code: updated.code },
  });
  return serializePromo(updated, new Prisma.Decimal(0));
}

export async function deletePromo(id: string, actorId: string) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AdminPromoError("This code doesn't exist", 404);
  const redemptionCount = await prisma.promoRedemption.count({ where: { promoId: id } });
  if (redemptionCount > 0) {
    throw new AdminPromoError(
      "This code has been used and can't be deleted. Pause it instead.",
      409,
    );
  }
  await prisma.promoRedemption.deleteMany({ where: { promoId: id } });
  await prisma.promoCode.delete({ where: { id } });
  await writeActivity({
    actorId,
    action: "promo_deleted",
    targetType: "promo",
    targetName: promo.code,
    meta: { code: promo.code },
  });
  return { deleted: true, code: promo.code };
}

export async function listPromoRedemptions(promoId: string, params: { page?: number; limit?: number }) {
  const promo = await prisma.promoCode.findUnique({ where: { id: promoId }, select: { id: true, code: true } });
  if (!promo) throw new AdminPromoError("This code doesn't exist", 404);

  const { page, limit, skip } = clampPaging(params.page, params.limit);
  const [rows, total] = await Promise.all([
    prisma.promoRedemption.findMany({
      where: { promoId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.promoRedemption.count({ where: { promoId } }),
  ]);

  const orders = await prisma.order.findMany({
    where: { id: { in: rows.map((r) => r.orderId) } },
    select: { id: true, orderNumber: true, customerName: true, customerId: true, createdAt: true },
  });
  const byOrder = new Map(orders.map((o) => [o.id, o]));

  return {
    rows: rows.map((r) => {
      const order = byOrder.get(r.orderId);
      return {
        id: r.id,
        order_number: order?.orderNumber ?? r.orderId,
        created_at: r.createdAt.toISOString(),
        customer_name: r.customerId ? (order?.customerName || "Customer") : "Walk-in",
        discount: toFixed2(r.discountAmount),
        status: r.status,
      };
    }),
    total,
    code: promo.code,
  };
}
