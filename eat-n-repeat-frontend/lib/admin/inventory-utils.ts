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
  "SALE_CANCEL_RELEASE",
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
  SALE_CANCEL_RELEASE: {
    label: "Sale Return",
    className: `${CARD_CLASS} bg-teal-50 text-teal-700 border-teal-200`,
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

/** Dense table datetime (en-PH, 12h) in Asia/Manila: "Oct 20, 3:12 PM". */
export function formatMovementDateTime(
  iso: string | null | undefined,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Date-only label ("Oct 23, 2026") in Asia/Manila for layer/movement received/expiry dates. */
export function formatLayerDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Asia/Manila date string YYYY-MM-DD */
export function getManilaDateString(date: Date = new Date()): string {
  const ms = date.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export type ExpiryStatus = {
  days: number;
  label: string; // "Expires today", "Tomorrow", "In 5 days", "Expired 2 days ago", "Expired yesterday"
  badgeLabel: string;
  badgeClass: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
};

/**
 * Calculates days left and badge classes relative to today in Asia/Manila.
 */
export function getExpiryStatus(
  expiryIsoOrDateStr: string | null | undefined,
  now: Date = new Date(),
): ExpiryStatus | null {
  if (!expiryIsoOrDateStr) return null;

  let expiryManilaStr = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiryIsoOrDateStr)) {
    expiryManilaStr = expiryIsoOrDateStr;
  } else {
    const d = new Date(expiryIsoOrDateStr);
    if (Number.isNaN(d.getTime())) return null;
    expiryManilaStr = getManilaDateString(d);
  }

  const todayManilaStr = getManilaDateString(now);
  const [ey, em, ed] = expiryManilaStr.split("-").map(Number);
  const [ty, tm, td] = todayManilaStr.split("-").map(Number);

  const expiryUtcMs = Date.UTC(ey, em - 1, ed);
  const todayUtcMs = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.round((expiryUtcMs - todayUtcMs) / (24 * 60 * 60 * 1000));

  const BADGE_BASE = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono whitespace-nowrap";

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const label = absDays === 1 ? "Expired yesterday" : `Expired ${absDays} days ago`;
    return {
      days: diffDays,
      label,
      badgeLabel: "Expired",
      badgeClass: `${BADGE_BASE} bg-rose-50 text-rose-700 border-rose-200`,
      isExpired: true,
      isExpiringSoon: false,
    };
  }

  if (diffDays === 0) {
    return {
      days: 0,
      label: "Expires today",
      badgeLabel: "Expires today",
      badgeClass: `${BADGE_BASE} bg-amber-100 text-amber-800 border-amber-300`,
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  if (diffDays === 1) {
    return {
      days: 1,
      label: "Tomorrow",
      badgeLabel: "Tomorrow",
      badgeClass: `${BADGE_BASE} bg-amber-50 text-amber-700 border-amber-200`,
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  if (diffDays <= 7) {
    return {
      days: diffDays,
      label: `In ${diffDays} days`,
      badgeLabel: `In ${diffDays} days`,
      badgeClass: `${BADGE_BASE} bg-amber-50 text-amber-700 border-amber-200`,
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  return {
    days: diffDays,
    label: `In ${diffDays} days`,
    badgeLabel: `In ${diffDays} days`,
    badgeClass: `${BADGE_BASE} bg-stone-100 text-stone-600 border-stone-200`,
    isExpired: false,
    isExpiringSoon: false,
  };
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
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] || 0);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s) - 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
