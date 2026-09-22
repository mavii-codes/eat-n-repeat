import { paymentsRepository } from "@/repositories/payments.repository";
import { xenditClient } from "@/lib/xendit";
import { v4 as uuidv4 } from "uuid";
import { cafeAvailabilityService } from "@/services/cafe-availability";

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

export async function checkout(
  data: { orderDetails: any; paymentMethod: string; orderMode?: string },
  customerId?: string
) {
  const { orderDetails, paymentMethod, orderMode = "online" } = data;
  const { customerName, phone, address, serviceAreaId, items: rawItems, deliveryFee, notes, type, subtotal: frontendSubtotal } = orderDetails;

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

  const total = subtotal + (deliveryFee || 0);
  const orderId = uuidv4();
  const orderNumber = generateOrderNumber();

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
    status: orderMode === "local" ? "pending" : "pending_payment",
    notes: notes || null,
    orderMode,
  });

  // For local mode cash orders, skip payment record — handled by Staff POS at cashier
  if (orderMode === "local") {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
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

  // For Xendit payment methods, create invoice
  if (paymentMethod === "gcash" || paymentMethod === "card" || paymentMethod === "bank_transfer") {
    try {
      const invoice = await xenditClient.Invoice.createInvoice({
        data: {
          externalId: orderNumber,
          amount: total,
          paymentMethods: [paymentMethod],
          description: `Order #${orderNumber}`,
        },
      });

      // Attach the created invoice to the EXISTING payment row (same id).
      // A second createPayment here would violate the PK (P2002) and turn
      // every successful Xendit invoice into a customer-facing 500.
      await paymentsRepository.updatePayment(payment.id, {
        xenditInvoiceId: invoice.id,
        xenditReference: invoice.invoiceUrl,
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
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
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
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

  // Create new Xendit invoice
  try {
    const invoice = await xenditClient.Invoice.createInvoice({
      data: {
        externalId: order.orderNumber,
        amount: Number(order.total),
        paymentMethods: [payment.paymentMethod],
        description: `Retry payment for Order #${order.orderNumber}`,
      },
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
