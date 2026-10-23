import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

/**
 * Promo-code core: language, pricing math, and transaction helpers.
 *
 * Design rules (see feature spec):
 * - The server is the only authority. The client never sends a discount,
 *   price, or total — only the raw code string. Everything below is computed
 *   from the code row and the SERVER-side subtotal.
 * - Money is Prisma Decimal(10,2); no floating-point arithmetic is exposed.
 * - Messages are exact product copy — never paraphrase them.
 * - Codes are stored uppercase (A-Z0-9, 4-20 chars) and matched
 *   case-insensitively on lookup.
 * - promo_redemptions links one order to one code (orderId @unique is the
 *   idempotency key across webhook / mark-as-paid / POS-cash "paid" paths).
 */

/** Transaction-scoped or regular client surface. */
type PromoDb = Prisma.TransactionClient | typeof prisma;

export type PromoCodeRow = Prisma.PromoCodeGetPayload<object>;

export type PromoEvaluation =
  | { ok: true; promo: PromoCodeRow; discount: Prisma.Decimal }
  | { ok: false; message: string };

/** Exact copy for every failure mode users can see. */
export const PROMO_MESSAGES = {
  INVALID: "This code isn't valid",
  PAUSED: "This code has been paused",
  NOT_STARTED: "This code hasn't started yet",
  EXPIRED: "This code has expired",
  WRONG_CHANNEL: "This code isn't available for this order type",
  POS_ANONYMOUS: "Not usable at the POS (walk-in customers can't be identified)",
  LOGIN_REQUIRED: "Log in to use this code",
  ALREADY_USED: "You've already used this code",
  LIMIT_REACHED: "This code has reached its limit",
  rateLimited: "Too many promo attempts. Please wait a few minutes and try again.",
} as const;

/** "Minimum order is ₱X" — X keeps two decimals only when needed. */
export function formatMinimumOrder(logoless: Prisma.Decimal | number | string): string {
  const d = new Prisma.Decimal(logoless).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return `Minimum order is ₱${d.toFixed(2).replace(/\.00$/, "")}`;
}

/** Trims trailing ".00": "30.00" → "30", "30.25" → "30.25". */
function trimZeros(fixed: string): string {
  return fixed.replace(/\.00$/, "");
}

/** ₱ display of a promo amount ("₱30" for 30, "₱30.25" for 30.25). */
export function formatPesoAmount(d: Prisma.Decimal | number | string): string {
  return `₱${trimZeros(
    new Prisma.Decimal(d).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
  )}`;
}

/** Case-insensitive lookup key: trim + uppercase, no other cleaning. */
export function normalizePromoCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/** Discount for a validated code against a subtotal. Caller has checked
 *  validity; this only computes money. Round to 2 decimals, clamp ≥ 0 and
 *  never exceed the subtotal so the final total cannot go negative. */
export function computeDiscount(
  promo: PromoCodeRow,
  subtotal: Prisma.Decimal | number | string,
): Prisma.Decimal {
  const base = new Prisma.Decimal(subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  let discount: Prisma.Decimal;
  if (String(promo.type).toUpperCase() === "FIXED") {
    discount = Prisma.Decimal.min(new Prisma.Decimal(promo.value), base);
  } else {
    let raw = base.times(new Prisma.Decimal(promo.value)).div(100);
    if (promo.maxDiscount != null) {
      raw = Prisma.Decimal.min(raw, new Prisma.Decimal(promo.maxDiscount));
    }
    discount = raw;
  }
  // Defensive clamps: never pay more than the subtotal, never negative.
  discount = Prisma.Decimal.max(Prisma.Decimal.min(discount, base), 0);
  return discount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Terminology check + pricing for a raw code string. Used both by the
 * standalone validate endpoint (preview) and by checkout (authoritative
 * apply). `customer` is the real logged-in customer identity, or null for
 * guests and anonymous POS walk-ins.
 */
export async function evaluatePromo(params: {
  codeRaw: unknown;
  subtotal: Prisma.Decimal | number | string;
  channel: "online" | "pos";
  customer: { id: string } | null;
  db?: PromoDb;
}): Promise<PromoEvaluation> {
  const db = params.db ?? prisma;
  const code = normalizePromoCode(params.codeRaw);
  if (!/^[A-Z0-9]{4,20}$/.test(code)) {
    return { ok: false, message: PROMO_MESSAGES.INVALID };
  }

  let promo: PromoCodeRow | null = null;
  try {
    promo = await db.promoCode.findUnique({ where: { code } });
  } catch {
    return { ok: false, message: PROMO_MESSAGES.INVALID };
  }
  if (!promo) {
    return { ok: false, message: PROMO_MESSAGES.INVALID };
  }

  const now = new Date();
  if (!promo.active) return { ok: false, message: PROMO_MESSAGES.PAUSED };
  if (now.getTime() < promo.startsAt.getTime()) {
    return { ok: false, message: PROMO_MESSAGES.NOT_STARTED };
  }
  if (promo.endsAt && now.getTime() > promo.endsAt.getTime()) {
    return { ok: false, message: PROMO_MESSAGES.EXPIRED };
  }

  const promoChannel = String(promo.channel).toUpperCase();
  if (promoChannel === "ONLINE" && params.channel === "pos") {
    return { ok: false, message: PROMO_MESSAGES.WRONG_CHANNEL };
  }
  if (promoChannel === "POS" && params.channel === "online") {
    return { ok: false, message: PROMO_MESSAGES.WRONG_CHANNEL };
  }

  // Identity rules. POS orders are anonymous walk-ins (customer is always
  // null): a POS-only-or-BOTH code that needs identification is rejected
  // there. Online guests with LOGGED_IN-only codes must sign in.
  const needsIdentity = promo.audience === "LOGGED_IN" || promo.oncePerCustomer;
  if (needsIdentity && !params.customer) {
    return {
      ok: false,
      message: params.channel === "pos" ? PROMO_MESSAGES.POS_ANONYMOUS : PROMO_MESSAGES.LOGIN_REQUIRED,
    };
  }

  if (promo.oncePerCustomer && params.customer) {
    const reuse = await db.promoRedemption.count({
      where: {
        promoId: promo.id,
        customerId: params.customer.id,
        status: { not: "RELEASED" },
      },
    });
    if (reuse > 0) return { ok: false, message: PROMO_MESSAGES.ALREADY_USED };
  }

  const subtotal = new Prisma.Decimal(params.subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (subtotal.lt(promo.minOrder)) {
    return { ok: false, message: formatMinimumOrder(promo.minOrder) };
  }

  if (promo.totalLimit != null && promo.usageCount >= promo.totalLimit) {
    return { ok: false, message: PROMO_MESSAGES.LIMIT_REACHED };
  }

  const discount = computeDiscount(promo, subtotal);
  return { ok: true, promo, discount };
}

/**
 * Reserves a redemption inside the ORDER-CREATION transaction. The usage
 * bump is the concurrency gate: a single conditional UPDATE on the row
 * serializes concurrent checkouts, so two orders can never both take the
 * last remaining use. Zero affected rows → 0 usage left → throw (rolling
 * back the whole order transaction).
 */
export async function reservePromoInOrderTx(
  tx: Prisma.TransactionClient,
  params: {
    promoId: string;
    orderId: string;
    customerId: string | null;
    discount: Prisma.Decimal;
  },
): Promise<void> {
  const bumped = await tx.promoCode.updateMany({
    where: {
      id: params.promoId,
      OR: [
        { totalLimit: null },
        { totalLimit: { gt: tx.promoCode.fields.usageCount } },
      ],
    },
    data: { usageCount: { increment: 1 } },
  });
  if (bumped.count === 0) {
    // Roll the entire order creation back with the exact copy.
    throw new PromoLimitError(PROMO_MESSAGES.LIMIT_REACHED);
  }
  await tx.promoRedemption.create({
    data: {
      id: `promo-red-${uuidv4()}`,
      promoId: params.promoId,
      orderId: params.orderId,
      customerId: params.customerId,
      discountAmount: params.discount,
      status: "RESERVED",
    },
  });
}

/** Thrown by reservePromoInOrderTx when the usage race is lost. Checkout
 *  callers translate it into the checkout rejection message. */
export class PromoLimitError extends Error {
  code = "PROMO_LIMIT_REACHED";
}

/**
 * Flips an order's redemption to APPLIED (paid/confirmed). Idempotent:
 * only a RESERVED redemption is promoted (an already-APPLIED or RELEASED
 * one is left untouched).
 */
export async function applyRedemptionForOrder(
  orderId: string,
  db: PromoDb = prisma,
): Promise<void> {
  await db.promoRedemption.updateMany({
    where: { orderId, status: "RESERVED" },
    data: { status: "APPLIED" },
  });
}

/**
 * Releases an order's redemption so the use is returned (cancel /
 * expired-or-failed invoice). Only RESERVED goes back: an APPLIED redemption
 * belongs to a paid order and stays counted. The usage decrement is guarded
 * so it can never drop below zero.
 */
export async function releaseRedemptionForOrder(
  orderId: string,
  db: PromoDb = prisma,
): Promise<void> {
  const redemption = await db.promoRedemption.findFirst({
    where: { orderId, status: "RESERVED" },
    select: { id: true, promoId: true },
  });
  if (!redemption) return;

  const released = await db.promoRedemption.updateMany({
    where: { id: redemption.id, status: "RESERVED" },
    data: { status: "RELEASED" },
  });
  if (released.count === 0) return; // concurrent release/apply won the race.

  await db.promoCode.updateMany({
    where: { id: redemption.promoId, usageCount: { gt: 0 } },
    data: { usageCount: { decrement: 1 } },
  });
}
