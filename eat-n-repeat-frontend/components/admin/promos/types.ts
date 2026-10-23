/* Promo Codes — row/query shapes mirroring the backend contract for
   /api/admin/promos/* exactly (snake_case rows as the backend sends them;
   money as fixed-2 strings, usage counters as numbers). */

export type PromoRow = {
  id: string;
  code: string;
  description?: string | null;
  type: "PERCENT" | "FIXED" | string;
  value: string;              // "10.00"
  max_discount: string | null; // "50.00" (PERCENT only)
  min_order: string;          // "200.00"
  starts_at: string;          // ISO
  ends_at: string | null;     // ISO
  total_limit: number | null; // absolute redemption cap
  per_customer_limit_once: boolean;
  audience: "EVERYONE" | "LOGGED_IN" | string;
  channel: "ONLINE" | "POS" | "BOTH" | string;
  active: boolean;
  usage_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  status: "ACTIVE" | "PAUSED" | "SCHEDULED" | "EXPIRED" | "USED_UP" | string;
  total_discounted?: string;  // "120.00" sum of live (non-released) discounts
};

/* One redemption-row behind GET /api/admin/promos/:id/redemptions. */
export type RedemptionRow = {
  id: string;
  order_number: string;       // falls back to the order id when a ghost twin
  created_at: string;         // ISO
  customer_name: string;      // resolved name or "Walk-in"
  discount: string;           // "30.00"
  status: "RESERVED" | "APPLIED" | "RELEASED" | string;
};

export type Page<T> = {
  rows: T[];
  total: number;
};

/* Query envelope for the promo-list fetcher; the backend consumes
   page/limit/search/status only. */
export type PromoListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;   // all | ACTIVE | PAUSED | SCHEDULED | EXPIRED | USED_UP
  sort?: string;
  dir?: "asc" | "desc";
};
