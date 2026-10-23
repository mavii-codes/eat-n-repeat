/**
 * Shared types for the POS receipt + "Paid Today" feature.
 *
 * These mirror the staff checkout response contract exactly
 * (`POST /api/payments/checkout` → `data.receipt`) and the
 * `GET /api/cash/pos-sales/today` payload. Keep them in sync with the
 * backend — the receipt modal renders ONLY from these shapes, never from
 * local cart state.
 */

export type POSReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
  isAddon?: boolean;
};

export type POSReceipt = {
  orderId: string | number;
  orderNumber: string;
  /** ISO timestamp (rendered in Asia/Manila via formatPhDateTime). */
  createdAt: string;
  cashier: string;
  orderType: "Dine-in" | "Takeout" | "Pick-up" | "Delivery" | string;
  items: POSReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  // Promo snapshot — the backend always sends these (discount 0 / null code
  // when no promo). subtotal carries the pre-discount item subtotal;
  // subtotalBeforeDiscount is the explicit before-discount base.
  subtotalBeforeDiscount: number;
  discount: number;
  promoCode: string | null;
  paymentMethod: "Cash" | "GCash" | string;
  cashTendered: number | null;
  change: number | null;
  changeBreakdown: string | null;
  status: string;
};

/** A row of the "Paid Today" list — same receipt fields plus a summary. */
export type PosSaleRow = POSReceipt & {
  itemsSummary: string;
};

export type PosSalesSummary = {
  count: number;
  totalCollected: number;
};

export type PosSalesTodayResponse = {
  success: boolean;
  date: string;
  timezone: string;
  summary: PosSalesSummary;
  sales: PosSaleRow[];
};

/** Shape of the staff checkout response (subset we consume). */
export type CheckoutResponse = {
  success?: boolean;
  orderId?: string | number;
  orderNumber?: string;
  message?: string;
  error?: string;
  receipt?: POSReceipt;
};
