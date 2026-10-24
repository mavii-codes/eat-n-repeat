import { paymentsRepository } from "@/repositories/payments.repository";
import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";
import { prisma } from "@/lib/prisma";
import { cashRepository } from "@/repositories/cash.repository";
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  phoneFormatMessage,
} from "@/services/customer-phone";
import { xenditClient } from "@/lib/xendit";
import { buildPosReceipt, parseReceiptNote } from "@/lib/pos-receipt";
import { emitAdminEvent } from "@/lib/sse";
import { STAFF_ROLES } from "@/middleware/requireRole.middleware";
import { logBlockedAttempt } from "@/middleware/security/blocked-attempts";
import { env } from "@/config/env";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { cafeAvailabilityService } from "@/services/cafe-availability";
import {
  applyRedemptionForOrder,
  evaluatePromo,
  reservePromoInOrderTx,
} from "@/services/promos/promos.service";
import { deductTrackedStockForOrder } from "@/services/stock/stock-order-sync";

const XENDIT_INVOICE_TIMEOUT_MS = 20000;

/**
 * Checkout abuse caps.
 *
 * "Completed order" (new-account cap exemption) is defined as an order that
 * either (a) has at least one payment row with status "PAID", or (b) has
 * reached a fulfilled terminal state ("delivered" or "completed"). Cancelled
 * orders never count as completed.
 *
 * "Open unpaid online order" is an online-mode order in
 * ("pending", "pending_payment", "awaiting_payment") with NO payment row in
 * status "PAID". ("pending" is the online COD awaiting-delivery state.)
 */
const COMPLETED_ORDER_STATUSES = ["completed", "delivered"] as const;
const OPEN_UNPAID_STATUSES = ["pending", "pending_payment", "awaiting_payment"] as const;

/** IP -> epoch ms of the last successful anonymous Xendit invoice creation. */
const guestInvoiceTimes = new Map<string, number>();
const GUEST_COOLDOWN_SWEEP_SIZE = 500;

function guestCooldownMs(): number {
  return Math.max(0, env.guestCheckoutCooldownMinutes * 60_000);
}

function assertGuestCooldown(ip: string | null): void {
  const cooldown = guestCooldownMs();
  if (cooldown <= 0) return;

  const key = ip || "unknown";
  const last = guestInvoiceTimes.get(key);
  if (last === undefined) return;

  if (Date.now() - last < cooldown) {
    logBlockedAttempt("guest-cooldown", ip, "guest_invoice_cooldown", {
      cooldownMinutes: env.guestCheckoutCooldownMinutes,
    });
    throw new ServiceError(
      "Too many orders from this connection. Please wait a few minutes.",
      429,
    );
  }
  guestInvoiceTimes.delete(key);
}

function recordGuestInvoice(ip: string | null): void {
  if (guestCooldownMs() <= 0) return;
  const now = Date.now();
  guestInvoiceTimes.set(ip || "unknown", now);

  if (guestInvoiceTimes.size >= GUEST_COOLDOWN_SWEEP_SIZE) {
    const cooldown = guestCooldownMs();
    for (const [key, at] of guestInvoiceTimes) {
      if (now - at >= cooldown) guestInvoiceTimes.delete(key);
    }
  }
}

async function enforceNewAccountCheckoutCaps(
  customerId: string,
  ip: string | null,
): Promise<void> {
  const completedOrders = await prisma.order.count({
    where: {
      customerId,
      OR: [
        { status: { in: [...COMPLETED_ORDER_STATUSES] } },
        { payments: { some: { status: "PAID" } } },
      ],
    },
  });
  // One completed order removes the new-account caps permanently.
  if (completedOrders > 0) return;

  const openUnpaid = await prisma.order.findMany({
    where: {
      customerId,
      orderMode: "online",
      status: { in: [...OPEN_UNPAID_STATUSES] },
      payments: { none: { status: "PAID" } },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (openUnpaid.length >= env.newAccountMaxOpenOrders) {
    logBlockedAttempt("new-account-cap", ip, "new_account_open_order_cap", {
      openOrders: openUnpaid.length,
      maxOpenOrders: env.newAccountMaxOpenOrders,
    });
    throw new ServiceError(
      "You have reached the limit for unpaid orders. Please complete a payment first.",
      429,
    );
  }

  const cooldownMs = Math.max(0, env.newAccountCooldownMinutes * 60_000);
  const newest = openUnpaid[0];
  if (newest && cooldownMs > 0 && Date.now() - newest.createdAt.getTime() < cooldownMs) {
    logBlockedAttempt("new-account-cooldown", ip, "new_account_order_cooldown", {
      cooldownMinutes: env.newAccountCooldownMinutes,
    });
    throw new ServiceError(
      "Please wait a few minutes before placing your next order.",
      429,
    );
  }
}

/** Xendit SDK calls carry no timeout of their own: race them so a stalled
 *  provider turns into a catchable 500 instead of a hung HTTP request
 *  (Express 4 never answers those, and clients spin forever). */
async function createInvoiceWithTimeout(payload: {
  externalId: string;
  amount: number;
  paymentMethods: string[];
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      xenditClient.Invoice.createInvoice({ data: payload }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Payment invoice timed out. Please try again.")), XENDIT_INVOICE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// Change breakdown for the cash-drawer audit trail (same denominations the
// POS receipt shows). Stored in the cash transaction reason; no schema field.
const PHP_DENOMINATIONS: Array<[number, string]> = [
  [1000, "1000 bill"],
  [500, "500 bill"],
  [200, "200 bill"],
  [100, "100 bill"],
  [50, "50 bill"],
  [20, "20 bill"],
  [10, "10 coin"],
  [5, "5 coin"],
  [1, "1 coin"],
  [0.25, "0.25 coin"],
];

function changeBreakdownLabel(change: number): string {
  let remaining = Math.round(change * 100) / 100;
  const parts: string[] = [];
  for (const [value, label] of PHP_DENOMINATIONS) {
    if (remaining >= value) {
      const count = Math.floor(remaining / value);
      remaining = Math.round((remaining - count * value) * 100) / 100;
      parts.push(`${count}x${label}`);
    }
  }
  return parts.join(", ");
}

// ── Pick-Up / Take-Out rules ──
// Minimum notice before the promised collection time (single configurable
// constant; the customer cart uses the same default so offered slots always
// satisfy this check). Overridable server-side via env for ops tuning.
export const PICKUP_PREP_BUFFER_MINUTES = Math.max(
  0,
  Number(process.env.PICKUP_PREP_BUFFER_MINUTES ?? 20) || 20
);
// Clock/transit grace: a checkout that lands a moment after the client
// generated its earliest slot must not be rejected by drift alone.
const PICKUP_BUFFER_GRACE_MS = 2 * 60 * 1000;
// Letters (Latin incl. accents), spaces, and . - ' only.
const PICKUP_NAME_REGEX = /^[A-Za-z\u00C0-\u024F .'-]+$/;

/** Trim + collapse inner whitespace; null when invalid (2-60, allowed chars). */
export function normalizePickupName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed.length < 2 || collapsed.length > 60) return null;
  if (!PICKUP_NAME_REGEX.test(collapsed)) return null;
  return collapsed;
}

/** Parse + window-check the promised pick-up time; throws ServiceError(400).
 *  Opening-hours cap is skipped when the café has no stored hours (none are
 *  stored in this project — display strings only). */
export function validatePickupAt(value: unknown): Date {
  const raw = typeof value === "string" ? value.trim() : "";
  const at = raw ? new Date(raw) : null;
  if (!at || Number.isNaN(at.getTime())) {
    throw new ServiceError("Please choose a valid pick-up time.", 400);
  }
  const earliest = Date.now() + PICKUP_PREP_BUFFER_MINUTES * 60 * 1000 - PICKUP_BUFFER_GRACE_MS;
  if (at.getTime() < earliest) {
    throw new ServiceError(
      `Pick-up time must be at least ${PICKUP_PREP_BUFFER_MINUTES} minutes from now.`,
      400
    );
  }
  return at;
}

// Where Xendit sends the customer after payment. Matches the return
// landing already implemented in app/customer/orders/page.tsx, which reads
// ?success=true|false&order=ORD-XXXX. Uses the real DB order number so the
// banner lands on the right order. Webhook stays the payment-truth authority.
function buildReturnUrls(orderNumber: string) {
  const base = env.customerReturnBase;
  const order = encodeURIComponent(orderNumber);
  return {
    successRedirectUrl: `${base}/customer/orders?success=true&order=${order}`,
    failureRedirectUrl: `${base}/customer/orders?success=false&order=${order}`,
  };
}

export interface CheckoutContext {
  /** Source IP, used for the guest invoice cooldown. */
  ip?: string | null;
  /** Authenticated principal kind; null/undefined means guest. */
  kind?: "user" | "customer" | null;
}

export async function checkout(
  data: { orderDetails: any; paymentMethod: string; orderMode?: string; cashReceived?: number },
  customerId?: string,
  context: CheckoutContext = {}
) {
  const { orderDetails, paymentMethod, orderMode = "online", cashReceived } = data;
  const { customerName, phone, address, serviceAreaId, items: rawItems, deliveryFee, notes, type, subtotal: frontendSubtotal, baseSubtotal: frontendBaseSubtotal, selectedAddons, pickupName: rawPickupName, pickupAt: rawPickupAt } = orderDetails;

  // Normalize once: callers send "GCash", "gcash", "Cash", etc. Branching
  // and the Xendit channel code below use this; the stored/display value
  // keeps the original casing so receipts and history are unchanged.
  const normalizedMethod = (paymentMethod || "").trim().toLowerCase();

  // ── Local Mode Restrictions ──
  if (orderMode === "local") {
    if (type === "delivery") {
      throw new ServiceError("Delivery orders are unavailable in Local Mode. Please use Online Mode.", 400);
    }
    const method = (paymentMethod || "").toLowerCase();
    if (method !== "cash") {
      throw new ServiceError("Only cash payments are accepted in Local Mode.", 400);
    }
  }

  // ── Pick-Up / Take-Out details ──
  // Only pickup orders carry these; delivery/dine-in ignore any values sent
  // (older clients or tampered requests must not persist them on other types).
  // Opening-hours cap: this project stores no café hours (display strings
  // only), so validation is buffer + not-in-the-past.
  let finalPickupName: string | null = null;
  let finalPickupAt: Date | null = null;
  if ((type || "").toLowerCase() === "pickup") {
    finalPickupName = normalizePickupName(rawPickupName);
    if (!finalPickupName) {
      throw new ServiceError(
        "Pick-up name is required: 2-60 characters, letters, spaces, and . - ' only.",
        400
      );
    }
    finalPickupAt = validatePickupAt(rawPickupAt);
  }

  // ── Online COD for Delivery ──
  // Allow Cash on Delivery for delivery orders in online mode.
  // This creates the order with PENDING payment status (unpaid).
  // No Xendit invoice is created; payment is collected by rider on delivery.
  const isOnlineCOD = orderMode !== "local" && type === "delivery" && normalizedMethod === "cash";

  // ── Online Ordering Availability Gate ──
  // Only gate non-local orders; local orders bypass availability check.
  if (orderMode !== "local") {
    const availability = await cafeAvailabilityService.resolve();
    if (availability.onlineOrdering !== "AVAILABLE") {
      throw new ServiceError(
        `ONLINE_ORDERING_UNAVAILABLE: Online ordering is currently unavailable. ${availability.reason ?? "Please try again later."}`,
        503
      );
    }
  }

  // Handle items being a string (plain text summary), a JSON string, or an array
  let items: any[];
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (typeof rawItems === "string") {
    try {
      items = JSON.parse(rawItems);
    } catch {
      items = [];
    }
  } else {
    items = [];
  }

  // Validate and fetch addons
  const addonIds = items.length > 0
    ? items.filter((item: any) => item.type === "addon").map((item: any) => item.id)
    : [];

  let addons: any[] = [];
  if (addonIds.length > 0) {
    addons = await paymentsRepository.findAddonsByIds(addonIds);
  }

  // Calculate subtotal from items if array, otherwise use frontend-provided subtotal
  let subtotal = 0;
  if (items.length > 0) {
    items.forEach((item: any) => {
      if (item.type === "addon") {
        const addon = addons.find((a: any) => a.id === item.id);
        if (addon) {
          subtotal += addon.price * (item.quantity || 1);
        }
      } else {
        subtotal += (item.price || 0) * (item.quantity || 1);
      }
    });
  } else {
    subtotal = frontendSubtotal || 0;
  }

  // ── Add-on validation: the database is the price authority ──
  // Add-ons are global by architecture (no per-item mapping), so an add-on
  // is "allowed" iff it exists and is available. Frontend add-on prices are
  // ignored entirely: every selected add-on is charged at its database
  // price, so DevTools edits cannot change what the customer pays.
  // Empty selection keeps the legacy path above (frontend subtotal trusted,
  // as before) so old clients are unaffected.
  const addonSelections = Array.isArray(selectedAddons) ? selectedAddons : [];
  if (addonSelections.length > 0) {
    const base = Number(frontendBaseSubtotal);
    if (!Number.isFinite(base) || base < 0) {
      throw new ServiceError("baseSubtotal is required when add-ons are selected.", 400);
    }
    const ids = [...new Set(addonSelections.map((a: any) => String(a?.id ?? "")))].filter(Boolean);
    if (ids.length === 0) {
      throw new ServiceError("Invalid add-on selection.", 400);
    }
    const dbAddons = await paymentsRepository.findAddonsByIds(ids);
    const byId = new Map(dbAddons.map((a: any) => [a.id, a]));
    let dbAddonTotal = 0;
    for (const sel of addonSelections) {
      const id = String((sel as any)?.id ?? "");
      const qty = Math.floor(Number((sel as any)?.quantity));
      const row: any = byId.get(id);
      if (!row) {
        throw new ServiceError(`Add-on not found: ${id}`, 400);
      }
      if (!row.available) {
        throw new ServiceError(`Add-on unavailable: ${row.name}`, 400);
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        throw new ServiceError(`Invalid quantity for add-on: ${row.name}`, 400);
      }
      dbAddonTotal += Number(row.price) * qty;
    }
    subtotal = base + dbAddonTotal;
  }

  // ── Staff detection (POS-initiated checkout) ──
  // req.auth.userId arrives as customerId; a hit in the staff users table
  // means this checkout was rung by staff (POS), not placed by a customer.
  // (Lifted above the promo block so counter sales are correctly treated
  // as anonymous walk-ins for promo identity rules.)
  let staffOperator: { id: string; name: string; role: string } | null = null;
  if (customerId) {
    try {
      staffOperator = await paymentsRepository.findStaffUserById(customerId);
      // Only real staff roles may use operator paths (POS receipts, drawer
      // attribution, client-supplied POS order numbers). Any other users-table
      // role is treated exactly like a non-staff caller.
      if (staffOperator && !(STAFF_ROLES as readonly string[]).includes(staffOperator.role)) {
        staffOperator = null;
      }
    } catch {
      staffOperator = null;
    }
  }

  // ── Promo code (server-authoritative) ──
  // The client sends ONLY the raw code string. The discount is computed
  // from the server-re-priced item subtotal and applied before any total
  // is used — cash change, drawer shift entry, and the Xendit invoice
  // amount all inherit the discounted total automatically. The POS codes
  // resolve against channel "pos", online codes against "online".
  let promoId: string | null = null;
  let promoCodeNormalized: string | null = null;
  let discountAmount = new Prisma.Decimal(0);
  let subtotalBeforeDiscount = new Prisma.Decimal(0);
  const promoCodeRaw =
    typeof (orderDetails as any)?.promoCode === "string" ? (orderDetails as any).promoCode : "";
  if (promoCodeRaw.trim()) {
    // A signed-in principal counts as a promo customer only when the token
    // is a customer JWT (staff-rung and local-mode sales stay anonymous).
    const promoCustomer =
      orderMode !== "local" && customerId && !staffOperator ? { id: customerId } : null;
    const promoEval = await evaluatePromo({
      codeRaw: promoCodeRaw,
      subtotal,
      channel: orderMode === "local" ? "pos" : "online",
      customer: promoCustomer,
    });
    if (!promoEval.ok) {
      // Exact product copy, 400 — the cart/POS surfaces it verbatim.
      throw new ServiceError(promoEval.message, 400);
    }
    promoId = promoEval.promo.id;
    promoCodeNormalized = promoEval.promo.code;
    discountAmount = promoEval.discount;
    subtotalBeforeDiscount = new Prisma.Decimal(subtotal);
  }

  const total = subtotal + (deliveryFee || 0) - Number(discountAmount);

  // Cash tendered / change for the drawer audit trail. The POS sends
  // cashReceived with every cash sale; the amount is informational (the
  // payment total stays `total`) and is stored in the cash transaction reason.
  const cashTendered = Number(cashReceived);
  const hasCashTendered = normalizedMethod === "cash" && Number.isFinite(cashTendered) && cashTendered > 0;
  const cashChange = hasCashTendered ? Math.max(0, Math.round((cashTendered - total) * 100) / 100) : 0;

  // Local Mode is the staff POS counter and creates no payment row: a
  // customer or guest token must never open one.
  if (orderMode === "local" && !staffOperator) {
    throw new ServiceError("Only staff or admin can open a POS sale.", 403);
  }

  // ── Checkout abuse caps ──
  // Staff/admin POS checkouts are never capped. New customer accounts are
  // capped until their first completed order; guests get an IP cooldown
  // between successful anonymous invoice creations.
  const authKind: "user" | "customer" | null = staffOperator
    ? "user"
    : context.kind ?? (customerId ? "customer" : null);
  const requestIp = context.ip ?? null;

  if (authKind === "customer" && customerId) {
    await enforceNewAccountCheckoutCaps(customerId, requestIp);
  } else if (authKind === null) {
    assertGuestCooldown(requestIp);
  }

  // ── Idempotent order numbers for staff retries ──
  // POS generates its own number (POS-...) and resends it after a timeout;
  // honoring it (staff callers ONLY — customer ORD-xxxx numbers are
  // low-entropy and must never collide across accounts) turns a retry into
  // a safe return-existing instead of a duplicate order / duplicate charge.
  const rawClientNumber =
    typeof (orderDetails as any)?.orderNumber === "string"
      ? (orderDetails as any).orderNumber.trim()
      : "";
  const staffOrderNumber =
    staffOperator && /^[\w-]{4,50}$/.test(rawClientNumber) ? rawClientNumber : null;
  if (staffOrderNumber) {
    const existing = await paymentsRepository.findOrderByNumber(staffOrderNumber);
    if (existing) {
      const latestPayment: any = (existing as any).payments?.[0] ?? null;
      let receipt: ReturnType<typeof buildPosReceipt> | null = null;
      if (staffOperator) {
        const cashTx = await cashRepository.findCashTransactionByOrderId(existing.id);
        receipt = buildPosReceipt({
          order: existing,
          cashier: staffOperator.name,
          paymentMethod:
            latestPayment?.paymentMethod ??
            (cashTx?.type === "gcash_sale" ? "gcash" : "cash"),
          ...parseReceiptNote(cashTx?.reason),
        });
      }
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        total: Number((existing as any).total),
        // GCash retry: hand back the live invoice instead of minting another.
        ...(latestPayment?.xenditReference ? { invoiceUrl: latestPayment.xenditReference } : {}),
        ...(receipt ? { receipt } : {}),
      };
    }
  }

  const orderId = uuidv4();
  const orderNumber = staffOrderNumber ?? generateOrderNumber();

  // ── Drawer association for staff-rung sales ──
  // Cash collected at the drawer joins the operator's open shift as a
  // 'sale' tx (expectedCash += amount). Staff-confirmed GCash joins as a
  // 'gcash_sale' tx: shown on the X-read, NEVER counted in the drawer.
  // Rider-collected COD and customer-placed orders never touch shifts.
  // Failures here must never fail the sale itself (order already saved).
  const recordShiftSale = async (kind: "sale" | "gcash_sale") => {
    if (!staffOperator || isOnlineCOD) return;
    try {
      const openShift = await cashRepository.findOpenShiftByStaffId(staffOperator.id);
      if (!openShift) return;
      const cashNote =
        kind === "sale" && hasCashTendered
          ? ` | tendered ${cashTendered.toFixed(2)} | change ${cashChange.toFixed(2)}${
              cashChange > 0 ? ` (${changeBreakdownLabel(cashChange)})` : ""
            }`
          : "";
      await cashRepository.createTransaction({
        id: uuidv4(),
        shiftId: openShift.id,
        type: kind,
        amount: total,
        adminId: staffOperator.id,
        adminName: staffOperator.name,
        reason: `POS ${kind === "sale" ? "cash" : "GCash"} sale ${orderNumber}${cashNote}`,
        timestamp: new Date(),
        orderId,
      });
      if (kind === "sale") {
        await cashRepository.updateShift(openShift.id, { expectedCash: { increment: total } });
      }
    } catch (e) {
      console.error("[checkout] shift attribution failed (order already saved):", e);
    }
  };

  // ── Phase 3: permanent mobile + address book (real customers only) ──
  // Guests, staff-rung POS sales, and local counter mode keep the legacy
  // behavior below untouched. For a signed-in customer, the stored number
  // (if any) always wins; a first-timer's number + new address are written
  // in the SAME database transaction as the order, so a failed order can
  // never persist them.
  const customerRow =
    customerId && !staffOperator && orderMode !== "local"
      ? await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, phone: true },
        })
      : null;

  // ── Customer link validation (FK safety) ──
  // Only a real customers.id may be stored on orders.customer_id. Staff-rung
  // POS sales and local-mode counter sales are anonymous: the authenticated
  // user is a staff user (users.id), which does NOT exist in customers, and
  // writing it triggered a P2003. The operator is recorded on the cash
  // transaction (adminId/adminName) instead.
  const finalCustomerId =
    staffOperator || orderMode === "local" ? null : customerId ?? null;
  if (finalCustomerId && !customerRow) {
    // A stale/deleted customer token must not reach the FK as a 500.
    throw new ServiceError("Customer account not found. Please sign in again.", 401);
  }

  // Resolved values actually stored on the order snapshot.
  let finalPhone: string | null = phone || null;
  let orderAddress: string | null = address || null;
  // First-time captures, persisted inside the order transaction.
  let phoneToSave: string | null = null;
  let addressToSave: {
    addressName: string;
    fullAddress: string;
    barangay: string;
    municipality: string;
  } | null = null;

  if (customerRow && customerId) {
    if (customerRow.phone) {
      // Saved number is permanent: the request value is ignored entirely.
      finalPhone = customerRow.phone;
    } else {
      const reqPhone = normalizePhoneNumber(phone);
      const reqConfirm = normalizePhoneNumber((orderDetails as any)?.confirmPhone);
      if (!reqPhone) {
        throw new ServiceError("Mobile number is required for your first order.", 400);
      }
      if (!isValidPhoneNumber(reqPhone)) {
        throw new ServiceError(phoneFormatMessage(), 400);
      }
      if (!reqConfirm) {
        throw new ServiceError("Please confirm your mobile number.", 400);
      }
      if (reqPhone !== reqConfirm) {
        throw new ServiceError("Mobile numbers do not match.", 400);
      }
      finalPhone = reqPhone;
      phoneToSave = reqPhone;
    }

    if (type === "delivery") {
      const savedAddressId =
        typeof (orderDetails as any)?.savedAddressId === "string"
          ? (orderDetails as any).savedAddressId.trim()
          : "";
      if (savedAddressId) {
        // Ownership enforced: the id must belong to this customer.
        const saved = await customerAddressesRepository.findFirst({
          id: savedAddressId,
          customerId,
        });
        if (!saved) {
          throw new ServiceError("Selected address is not in your address book.", 403);
        }
        orderAddress = saved.fullAddress;
      } else {
        const text = (address || "").trim();
        if (!text) {
          throw new ServiceError("A delivery address is required.", 400);
        }
        orderAddress = text;
        const existing = await customerAddressesRepository.findManyByCustomerId(customerId);
        const duplicate = existing.some(
          (a) => a.fullAddress.trim().toLowerCase() === text.toLowerCase(),
        );
        if (!duplicate) {
          const rawLabel = (orderDetails as any)?.addressLabel;
          const label =
            typeof rawLabel === "string" && rawLabel.trim()
              ? rawLabel.trim().slice(0, 100)
              : existing.length === 0
                ? "Home"
                : `Address ${existing.length + 1}`;
          addressToSave = {
            addressName: label,
            fullAddress: text,
            barangay: "",
            municipality: "Cordova",
          };
        }
      }
    }
  }

  // Create order
  const orderPayload = {
    id: orderId,
    orderNumber,
    customerId: finalCustomerId,
    customerName,
    phone: finalPhone,
    address: orderAddress,
    serviceAreaId: serviceAreaId || null,
    type: type || "dine-in",
    items: items.length > 0 ? JSON.stringify(items) : typeof rawItems === "string" ? rawItems : JSON.stringify(rawItems),
    subtotal,
    deliveryFee: deliveryFee || 0,
    total,
    // COD delivery orders: status "pending" (awaiting rider delivery + cash collection)
    // Other online orders: "pending_payment" (awaiting online payment)
    // Local mode: "pending" (will be paid at cashier)
    status: isOnlineCOD ? "pending" : orderMode === "local" ? "pending" : "pending_payment",
    notes: notes || null,
    // Null for delivery/dine-in and legacy clients (only set for pickup).
    pickupName: finalPickupName,
    pickupAt: finalPickupAt,
    orderMode,
    // Promo snapshot: the normalized code, the pre-discount item subtotal,
    // and the computed discount. `total` above already reflects it.
    promoCode: promoCodeNormalized,
    subtotalBeforeDiscount: promoId ? subtotalBeforeDiscount : null,
    discountAmount,
  };

  const itemsForStockDeduction = Array.isArray((orderDetails as any)?.orderItems)
    ? (orderDetails as any).orderItems
    : Array.isArray(items)
      ? items
      : [];

  const stockActor = staffOperator
    ? { id: staffOperator.id, name: staffOperator.name }
    : { id: finalCustomerId ?? "customer", name: customerName || "Customer" };

  const order = await prisma.$transaction(async (tx) => {
    if (customerRow && phoneToSave) {
      await tx.customer.update({
        where: { id: customerId },
        data: { phone: phoneToSave },
      });
    }
    if (customerRow && addressToSave) {
      const addressCount = await tx.customerAddress.count({ where: { customerId } });
      await tx.customerAddress.create({
        data: {
          id: uuidv4(),
          customerId: customerId!,
          ...addressToSave,
          landmarks: null,
          deliveryNotes: null,
          isDefault: addressCount === 0,
        },
      });
    }

    const created = await tx.order.create({ data: orderPayload });

    // Deduct tracked inventory stock (D1 & D2)
    await deductTrackedStockForOrder(tx, created, itemsForStockDeduction, stockActor);

    if (promoId) {
      await reservePromoInOrderTx(tx, {
        promoId,
        orderId: created.id,
        customerId: finalCustomerId,
        discount: discountAmount,
      });
      if (orderMode === "local") await applyRedemptionForOrder(created.id, tx);
    }
    return created;
  });

  // Both the customer-row transaction path and the POS path converge here:
  // one admin invalidation event per successful checkout.
  try {
    emitAdminEvent({ type: "ORDER_UPDATED", at: new Date().toISOString() });
  } catch {
    /* event must never break the write */
  }

  // For local mode cash orders, skip payment record — handled by Staff POS at cashier
  if (orderMode === "local") {
    if (normalizedMethod === "cash") await recordShiftSale("sale");
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      ...(staffOperator
        ? {
            receipt: buildPosReceipt({
              order,
              cashier: staffOperator.name,
              paymentMethod: normalizedMethod,
              cashTendered: hasCashTendered ? cashTendered : null,
              change: hasCashTendered ? cashChange : null,
              changeBreakdown:
                hasCashTendered && cashChange > 0 ? changeBreakdownLabel(cashChange) : null,
            }),
          }
        : {}),
    };
  }

  // For COD delivery orders, create payment record with PENDING status
  // but skip Xendit invoice creation. Payment will be collected by rider on delivery.
  if (isOnlineCOD) {
    const paymentId = uuidv4();
    await paymentsRepository.createPayment({
      id: paymentId,
      orderId: order.id,
      paymentMethod,
      amount: total,
      status: "PENDING",
    });
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
    };
  }

  // Create payment record
  const paymentId = uuidv4();
  const payment = await paymentsRepository.createPayment({
    id: paymentId,
    orderId: order.id,
    paymentMethod,
    amount: total,
    status: "PENDING",
  });

  // For Xendit payment methods, create invoice. Xendit channel codes are
  // uppercase (GCash one-time code is "GCASH"); the normalized method makes
  // "GCash"/"gcash" (and any casing) reach this branch correctly.
  const xenditChannel =
    normalizedMethod === "gcash"
      ? "GCASH"
      : normalizedMethod === "card" || normalizedMethod === "bank_transfer"
        ? paymentMethod
        : null;
  if (xenditChannel) {
    try {
      const returnUrls = buildReturnUrls(orderNumber);
      const invoice = await createInvoiceWithTimeout({
        externalId: orderNumber,
        amount: total,
        paymentMethods: [xenditChannel],
        description: `Order #${orderNumber}`,
        successRedirectUrl: returnUrls.successRedirectUrl,
        failureRedirectUrl: returnUrls.failureRedirectUrl,
      });

      // Anonymous invoice created successfully: start the per-IP cooldown.
      if (authKind === null) recordGuestInvoice(requestIp);

      // Attach the created invoice to the EXISTING payment row (same id).
      // A second createPayment here would violate the PK (P2002) and turn
      // every successful Xendit invoice into a customer-facing 500.
      await paymentsRepository.updatePayment(payment.id, {
        xenditInvoiceId: invoice.id,
        xenditReference: invoice.invoiceUrl,
      });

      // Staff-confirmed GCash only: invoice exists, collection confirmed at
      // the counter. Displayed on the X-read, never in the cash drawer.
      if (staffOperator && normalizedMethod === "gcash") await recordShiftSale("gcash_sale");

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        invoiceUrl: invoice.invoiceUrl,
        ...(staffOperator
          ? {
              receipt: buildPosReceipt({
                order,
                cashier: staffOperator.name,
                paymentMethod: normalizedMethod,
                cashTendered: hasCashTendered ? cashTendered : null,
                change: hasCashTendered ? cashChange : null,
                changeBreakdown:
                  hasCashTendered && cashChange > 0 ? changeBreakdownLabel(cashChange) : null,
              }),
            }
          : {}),
      };
    } catch (error: any) {
      throw new ServiceError(
        error.message || "Failed to create payment invoice",
        500
      );
    }
  }

  // For cash payments, return immediately
  if (normalizedMethod === "cash") await recordShiftSale("sale");
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    ...(staffOperator
      ? {
          receipt: buildPosReceipt({
            order,
            cashier: staffOperator.name,
            paymentMethod: normalizedMethod,
            cashTendered: hasCashTendered ? cashTendered : null,
            change: hasCashTendered ? cashChange : null,
            changeBreakdown:
              hasCashTendered && cashChange > 0 ? changeBreakdownLabel(cashChange) : null,
          }),
        }
      : {}),
  };
}

export async function getPaymentByOrderId(orderId: string) {
  return paymentsRepository.findPaymentByOrderIdentifier(orderId);
}

export async function retryPayment(orderId: string) {
  const order = await paymentsRepository.findOrderByIdentifier(orderId);
  if (!order) {
    throw new ServiceError("Order not found", 404);
  }

  const payment = await paymentsRepository.findPaymentByOrderIdentifier(orderId);
  if (!payment) {
    throw new ServiceError("Payment record not found", 404);
  }

  if (payment.status === "PAID") {
    throw new ServiceError("Order is already paid", 400);
  }

  // ── Online Ordering Availability Gate ──
  // Only gate non-local orders; local orders bypass availability check.
  if (order.orderMode !== "local") {
    const availability = await cafeAvailabilityService.resolve();
    if (availability.onlineOrdering !== "AVAILABLE") {
      throw new ServiceError(
        `ONLINE_ORDERING_UNAVAILABLE: Online ordering is currently unavailable. ${availability.reason ?? "Please try again later."}`,
        503
      );
    }
  }

  // Create new Xendit invoice. Stored methods keep display casing
  // ("GCash"); normalize to the Xendit channel code ("GCASH") here.
  const retryChannel =
    String(payment.paymentMethod || "").trim().toLowerCase() === "gcash"
      ? "GCASH"
      : payment.paymentMethod;
  try {
    const returnUrls = buildReturnUrls(order.orderNumber);
    const invoice = await createInvoiceWithTimeout({
      externalId: order.orderNumber,
      amount: Number(order.total),
      paymentMethods: [retryChannel],
      description: `Retry payment for Order #${order.orderNumber}`,
      successRedirectUrl: returnUrls.successRedirectUrl,
      failureRedirectUrl: returnUrls.failureRedirectUrl,
    });

    await paymentsRepository.createPayment({
      id: uuidv4(),
      orderId: order.id,
      paymentMethod: payment.paymentMethod,
      xenditInvoiceId: invoice.id,
      xenditReference: invoice.invoiceUrl,
      amount: Number(order.total),
      status: "PENDING",
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceUrl: invoice.invoiceUrl,
    };
  } catch (error: any) {
    throw new ServiceError(
      error.message || "Failed to create retry payment",
      500
    );
  }
}
