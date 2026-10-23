/* User Management — shared row/query shapes for the /admin/users page.
   These types mirror the backend contract for /api/admin/users/* and the
   existing /api/admin/customers/:id/phone endpoint. Kept loose deliberately:
   the backend lands shortly after the UI, so every field ships optional-safe
   defaults instead of crashing on a slower field. */

export type StaffRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  archived?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  hasOpenShift?: boolean;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  openUnpaidOrders?: number;
  /* Additive (Phase 3): present when the customer currently has an open
     review flag. Null/absent = nothing to surface. */
  openFlag?: {
    id: string;
    outcome: string;
    rule?: string | null;
    flaggedAt: string;
  } | null;
};

export type ActivityMeta = Record<string, unknown> | string | null | undefined;

export type ActivityRow = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  meta: ActivityMeta;
  createdAt: string;
};

export type Page<T> = {
  rows: T[];
  total: number;
};

/* Query envelope shared by the page's fetch helpers. Fields the backend
   contract doesn't accept (e.g. `sort` on the activity endpoint) are simply
   ignored by the matching fetcher. */
export type UserListQuery = {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  role?: string;
  status?: string;
  action?: string;
  from?: string;
  to?: string;
  /* Phase 3 flag list: the flags endpoint reads them as `status` and
     `outcome` query params (see buildFlagsQuery). */
  flagStatus?: string;
  outcome?: string;
};

/* The action strings the backend audit log emits (verbatim values from
   /api/admin/users/activity). Phase 3 adds the customer-report / flag
   lifecycle actions to the same list. */
export const ACTIVITY_ACTIONS = [
  "staff_disabled",
  "staff_enabled",
  "staff_password_reset",
  "customer_disabled",
  "customer_enabled",
  "customer_phone_edited",
  "initial_password_change",
  "customer_reported",
  "system_customer_flagged",
  "flag_approved",
  "flag_watching",
  "flag_dismissed",
  "flag_auto_dismissed",
] as const;

/* ── Customer report flags (Phase 3) ───────────────────────────────────────
   Shapes behind GET /api/admin/users/flags. status = open | dismissed;
   outcome = pending | approved | watching; rule = manual | signup_ip |
   cancelled_streak | failed_logins (system flags) or the id of the staff
   report that seeded them. Kept loose like every row shape here. */

export type FlagCustomerSummary = {
  name: string;
  email: string;
  phone?: string | null;
  status: string;
};

export type FlagRow = {
  id: string;
  customerId: string;
  status: string;
  outcome: string;
  reason: string;
  flaggedByKind: string;
  flaggedByName?: string | null;
  rule?: string | null;
  meta?: ActivityMeta;
  flaggedAt: string;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  customer: FlagCustomerSummary;
  openUnpaidOrders?: number;
};

/* What an order row must carry for the "Flag customer" entry point. Only the
   ordering customer's id is required; pages read it defensively via
   flagCustomerIdOf so walk-in / offline-only rows never offer the action. */
export type FlagCustomerTarget = {
  customerId: string;
  customerName: string;
  phone?: string | null;
  orderNumber?: string | null;
};
