import type { DeliveryStatus } from "@/lib/admin/types";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const activeDeliveryStatuses: DeliveryStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
];

export const historyDeliveryStatuses: DeliveryStatus[] = [
  "delivered",
  "cancelled",
];

export const deliveryStatusStyles: Record<DeliveryStatus, string> = {
  pending: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  confirmed: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  preparing: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  out_for_delivery: "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
  delivered: "bg-green-100 text-green-800 ring-1 ring-green-200",
  cancelled: "bg-red-100 text-red-800 ring-1 ring-red-200",
};

export function formatDeliveryDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Order time for Staff/Admin displays in Philippine Time (Asia/Manila).
 * Source timestamps are UTC (DB `createdAt`); the IANA zone — not a
 * hard-coded +8 offset — converts correctly. Returns "" when unparseable
 * so tables render a clean blank instead of "Invalid Date".
 */
export function formatPhTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

/**
 * Full Staff-facing order timestamp: "Sep 29, 2026 • 5:07 PM"
 * (Asia/Manila). Falls back to a legacy display string (e.g. "4:41 PM"
 * from older cached rows) when no ISO timestamp exists, else "".
 */
export function formatPhDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const date = d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
  return `${date} • ${formatPhTime(d)}`;
}

/** Display helper for an order-like row: ISO first, legacy label fallback. */
export function formatOrderDateTime(order: {
  orderedAt?: string | null;
  time?: string | null;
}): string {
  return formatPhDateTime(order.orderedAt ?? order.time ?? "");
}

/**
 * Underlying creation epoch (ms) for newest-first sorting. Never sorts on
 * formatted text: ISO timestamp first, legacy `time` parse second, 0 last.
 */
export function orderEpoch(order: {
  orderedAt?: string | null;
  time?: string | null;
}): number {
  if (order.orderedAt) {
    const t = new Date(order.orderedAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (order.time) {
    const t = new Date(order.time).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}
