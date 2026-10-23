// Pure receipt mapping shared by POS checkout responses and the "Paid Today"
// summary. No I/O: callers supply the order row, cashier label, and payment
// metadata so the same receipt shape is used everywhere.

export type PosReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
  isAddon?: boolean;
};

export type PosReceipt = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  cashier: string;
  orderType: string;
  items: PosReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  // Promo fields (present for every sale; zero/null when no code applied).
  subtotalBeforeDiscount: number;
  discount: number;
  promoCode: string | null;
  paymentMethod: string;
  cashTendered: number | null;
  change: number | null;
  changeBreakdown: string | null;
  status: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function orderTypeLabel(type: unknown): string {
  switch (String(type ?? "").trim().toLowerCase()) {
    case "dine-in":
      return "Dine-in";
    case "takeout":
      return "Takeout";
    case "pickup":
      return "Pick-up";
    default:
      return "Delivery";
  }
}

function paymentMethodLabel(method: unknown): string {
  const original = typeof method === "string" ? method.trim() : "";
  if (!original) return "";
  const normalized = original.toLowerCase();
  if (normalized === "cash") return "Cash";
  if (normalized === "gcash") return "GCash";
  return original.charAt(0).toUpperCase() + original.slice(1);
}

function parseItems(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function buildPosReceipt(input: {
  order: any;
  cashier: string;
  paymentMethod: string;
  cashTendered?: number | null;
  change?: number | null;
  changeBreakdown?: string | null;
}): PosReceipt {
  const { order, cashier, paymentMethod } = input;

  const items: PosReceiptItem[] = parseItems(order?.items).map((item: any) => {
    const quantity = Number(item?.quantity) || 1;
    const unitPrice = Number(item?.price) || 0;
    return {
      name: String(item?.name ?? item?.menuItemName ?? "Item"),
      quantity,
      unitPrice,
      lineTotal: round2(unitPrice * quantity),
      notes: toStringOrNull(item?.notes),
      isAddon: item?.type === "addon",
    };
  });

  const created = new Date(order?.createdAt ?? Date.now());

  return {
    orderId: String(order?.id ?? ""),
    orderNumber: String(order?.orderNumber ?? ""),
    createdAt: (Number.isNaN(created.getTime()) ? new Date() : created).toISOString(),
    cashier,
    orderType: orderTypeLabel(order?.type),
    items,
    subtotal: Number(order?.subtotal) || 0,
    tax: 0,
    deliveryFee: Number(order?.deliveryFee) || 0,
    total: Number(order?.total) || 0,
    // Promo fields straight off the order snapshot; legacy orders without
    // a snapshot (all orders before promo support) fall back to no discount.
    subtotalBeforeDiscount:
      order?.subtotalBeforeDiscount != null
        ? Number(order.subtotalBeforeDiscount)
        : Number(order?.subtotal) || 0,
    discount: Number(order?.discountAmount) || 0,
    promoCode: toStringOrNull(order?.promoCode),
    paymentMethod: paymentMethodLabel(paymentMethod),
    cashTendered: toNumberOrNull(input.cashTendered),
    change: toNumberOrNull(input.change),
    changeBreakdown: toStringOrNull(input.changeBreakdown),
    status: String(order?.status ?? ""),
  };
}

/** Extracts POS cash details from a cash_transaction reason:
 *  `... | tendered 500.00 | change 62.50 (1x50 bill, 1x10 coin)`. */
export function parseReceiptNote(reason: string | null | undefined): {
  cashTendered: number | null;
  change: number | null;
  changeBreakdown: string | null;
} {
  if (typeof reason !== "string") {
    return { cashTendered: null, change: null, changeBreakdown: null };
  }

  const match = reason.match(
    /tendered\s+([\d.]+)\s*\|\s*change\s+([\d.]+)(?:\s*\(([^)]*)\))?/i
  );
  if (!match) {
    return { cashTendered: null, change: null, changeBreakdown: null };
  }

  const cashTendered = Number(match[1]);
  const change = Number(match[2]);
  return {
    cashTendered: Number.isFinite(cashTendered) ? cashTendered : null,
    change: Number.isFinite(change) ? change : null,
    changeBreakdown: match[3]?.trim() || null,
  };
}

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Asia/Manila is fixed UTC+8 (no DST). Start inclusive, end exclusive. */
export function manilaDayRange(now: Date = new Date()): {
  start: Date;
  end: Date;
  date: string;
} {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const date = manila.toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date };
}
