import { paymentsRepository } from "@/repositories/payments.repository";
import { cashRepository } from "@/repositories/cash.repository";
import { xenditClient } from "@/lib/xendit";
import { env } from "@/config/env";
import { v4 as uuidv4 } from "uuid";
import { cafeAvailabilityService } from "@/services/cafe-availability";

const XENDIT_INVOICE_TIMEOUT_MS = 20000;

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

export async function checkout(
  data: { orderDetails: any; paymentMethod: string; orderMode?: string },
  customerId?: string
) {
  const { orderDetails, paymentMethod, orderMode = "online" } = data;
  const { customerName, phone, address, serviceAreaId, items: rawItems, deliveryFee, notes, type, subtotal: frontendSubtotal, baseSubtotal: frontendBaseSubtotal, selectedAddons } = orderDetails;

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

  const total = subtotal + (deliveryFee || 0);

  // ── Staff detection (POS-initiated checkout) ──
  // req.auth.userId arrives as customerId; a hit in the staff users table
  // means this checkout was rung by staff (POS), not placed by a customer.
  let staffOperator: { id: string; name: string; role: string } | null = null;
  if (customerId) {
    try {
      staffOperator = await paymentsRepository.findStaffUserById(customerId);
    } catch {
      staffOperator = null;
    }
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
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        total: Number((existing as any).total),
        // GCash retry: hand back the live invoice instead of minting another.
        ...(latestPayment?.xenditReference ? { invoiceUrl: latestPayment.xenditReference } : {}),
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
      await cashRepository.createTransaction({
        id: uuidv4(),
        shiftId: openShift.id,
        type: kind,
        amount: total,
        adminId: staffOperator.id,
        adminName: staffOperator.name,
        reason: `POS ${kind === "sale" ? "cash" : "GCash"} sale ${orderNumber}`,
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

  // Create order
  const order = await paymentsRepository.createOrder({
    id: orderId,
    orderNumber,
    customerId: customerId || null,
    customerName,
    phone: phone || null,
    address: address || null,
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
    orderMode,
  });

  // For local mode cash orders, skip payment record — handled by Staff POS at cashier
  if (orderMode === "local") {
    if (normalizedMethod === "cash") await recordShiftSale("sale");
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
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
