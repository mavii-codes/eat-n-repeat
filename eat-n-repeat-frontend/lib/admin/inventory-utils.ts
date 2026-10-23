import type { StockMovement } from "@/lib/admin/types";

/**
 * Shared helpers for the admin Inventory surfaces (dashboard, stock-in,
 * adjust, history). Follows the lib/ conventions: pure functions, typed,
 * no React. Badge styling mirrors the Cash Management badge classes.
 */

/** Small uppercase filter/select control, identical to Cash Management. */
export const FILTER_CONTROL_CLASS =
  "text-xs font-semibold text-stone-700 border border-stone-300 rounded-lg pl-2 pr-2 py-1.5 bg-white focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000] outline-none cursor-pointer";

const CARD_CLASS =
  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono";

export const STOCK_MOVEMENT_TYPES = [
  "STOCK_IN",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "SALE_DEDUCTION",
  "OPENING_BALANCE",
] as const;

export type StockMovementTypeValue = (typeof STOCK_MOVEMENT_TYPES)[number];

const MOVEMENT_BADGES: Record<
  StockMovementTypeValue,
  { label: string; className: string }
> = {
  STOCK_IN: {
    label: "Stock In",
    className: `${CARD_CLASS} bg-emerald-50 text-emerald-700 border-emerald-200`,
  },
  ADJUSTMENT_ADD: {
    label: "Adj +",
    className: `${CARD_CLASS} bg-blue-50 text-blue-700 border-blue-200`,
  },
  ADJUSTMENT_REMOVE: {
    label: "Adj −",
    className: `${CARD_CLASS} bg-amber-50 text-amber-700 border-amber-200`,
  },
  SALE_DEDUCTION: {
    label: "Sale",
    className: `${CARD_CLASS} bg-rose-50 text-rose-700 border-rose-200`,
  },
  OPENING_BALANCE: {
    label: "Opening",
    className: `${CARD_CLASS} bg-stone-100 text-stone-600 border-stone-200`,
  },
};

/** Badge label + Cash-Management-styled classes for a movement type. */
export function getStockMovementBadge(type: string | null | undefined): {
  label: string;
  className: string;
} {
  const key = (type || "") as StockMovementTypeValue;
  return (
    MOVEMENT_BADGES[key] ?? {
      label: type || "—",
      className: `${CARD_CLASS} bg-stone-100 text-stone-600 border-stone-200`,
    }
  );
}

/** Compact human label for the type filter dropdown. */
export function getStockMovementLabel(type: string): string {
  return getStockMovementBadge(type).label;
}

/**
 * Source tag for one FIFO cost layer ("sm-…" = a stock-in movement,
 * "opening" = initial baseline, "residual" = auto-recovered remainder).
 */
export function getStockLayerSource(
  sourceRef: string | null | undefined,
): { label: string; className: string } {
  if (sourceRef === "opening") {
    return {
      label: "Opening",
      className: `${CARD_CLASS} bg-stone-100 text-stone-600 border-stone-200`,
    };
  }
  if (sourceRef === "residual") {
    return {
      label: "Auto-recovered",
      className: `${CARD_CLASS} bg-blue-50 text-blue-700 border-blue-200`,
    };
  }
  if (sourceRef && sourceRef.startsWith("sm-")) {
    return {
      label: "Stock In",
      className: `${CARD_CLASS} bg-emerald-50 text-emerald-700 border-emerald-200`,
    };
  }
  return { label: "—", className: "" };
}

/** Inline ₱ amount, JS-side: `₱1234.50` */
export function peso(value: unknown): string {
  const n = Number(value);
  return `₱${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

/** Quantity with PH thousands separators, max 2 decimals. */
export function fmtQty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

/** Signed ± quantity ("+2", "-3", "0"); falls back to "—" when unparseable. */
export function signedQty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmtQty(Math.abs(n))}`;
}

/** Total cost for a movement row: server value first, else unitCost × |qty|. */
export function movementTotalCost(row: StockMovement): number | null {
  if (row.totalCost != null && Number.isFinite(Number(row.totalCost))) {
    return Number(row.totalCost);
  }
  const unit = Number(row.unitCost);
  const qty = Number(row.quantityChange);
  if (row.unitCost != null && Number.isFinite(unit) && Number.isFinite(qty)) {
    return Math.abs(unit * qty);
  }
  return null;
}

/** Dense table datetime (en-PH, 12h): "Oct 20, 3:12 PM". */
export function formatMovementDateTime(
  iso: string | null | undefined,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Current wall-clock time in Asia/Manila as a `datetime-local` value
 * ("YYYY-MM-DDTHH:mm"). PH has no DST (fixed UTC+8).
 */
export function phNowLocalInput(): string {
  const now = new Date();
  const ph = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  if (Number.isNaN(ph.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ph.getFullYear()}-${pad(ph.getMonth() + 1)}-${pad(ph.getDate())}T${pad(
    ph.getHours(),
  )}:${pad(ph.getMinutes())}`;
}

/**
 * Convert a `datetime-local` string interpreted as Asia/Manila wall time
 * (fixed UTC+8, no DST) into an ISO UTC timestamp for the API.
 */
export function phLocalInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const ms = Date.UTC(y, mo - 1, d, h, mi) - 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
