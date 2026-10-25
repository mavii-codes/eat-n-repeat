"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { initialAdminData } from "@/lib/admin/mock-data";
import { ensureHashed } from "@/lib/admin/password";
import { formatPhDateTime } from "@/lib/admin/delivery-utils";
import {
  normalizeExpense,
  normalizeExpenses,
} from "@/lib/admin/expense-utils";
import type {
  AdminDataState,
  CashShift,
  DeliveryOrder,
  DeliveryOrderInput,
  DeliverySettings,
  DeliveryStatus,
  ExpenseItem,
  ExpensesSummary,
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  RecentOrder,
  SalesDataPoint,
  SalesFigures,
  ServiceArea,
  ServiceAreaInput,
  StaffAccount,
  StaffAccountInput,
  StockAdjustInput,
  StockCategory,
  StockCategoryInput,
  StockDashboardResponse,
  StockInInput,
  StockItem,
  StockItemInput,
  StockLayer,
  StockMovement,
  StockMovementPage,
  StockMutationItemSnapshot,
  StockMutationResponse,
  StockRequest,
  StockRequestInput,
  SystemSettings,
} from "@/lib/admin/types";

const STORAGE_KEY = "eat-n-repeat-admin-data";
const MENU_API_TIMEOUT_MS = 8000;

import { getStaffOrAdminToken, getTokenRole } from "@/lib/admin/auth-token";
import { subscribeAdminEvents } from "@/lib/admin/admin-events";
export { getStaffOrAdminToken };

const SALES_EVENTS_DEBOUNCE_MS = 1000;

function salesNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSalesPoints(value: unknown): SalesDataPoint[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const point = (
      entry && typeof entry === "object" ? entry : {}
    ) as Record<string, unknown>;
    return {
      label: typeof point.label === "string" ? point.label : "",
      amount: salesNumber(point.amount),
    };
  });
}

function normalizeSalesFigures(raw: unknown): SalesFigures {
  const json = (
    raw && typeof raw === "object" ? raw : {}
  ) as Record<string, unknown>;
  const todayRaw = (
    json.today && typeof json.today === "object" ? json.today : {}
  ) as Record<string, unknown>;
  const changeRaw = json.change_pct;
  const changePct =
    changeRaw == null ? null : Number.isFinite(Number(changeRaw)) ? Number(changeRaw) : null;

  return {
    today: {
      revenue: salesNumber(todayRaw.revenue),
      orders: salesNumber(todayRaw.orders),
      completed: salesNumber(todayRaw.completed),
      pending: salesNumber(todayRaw.pending),
      // Older backends omit the promo figures; fall back to 0 / revenue.
      totalDiscounts: salesNumber(todayRaw.total_discounts),
      grossBeforeDiscounts:
        todayRaw.gross_sales_before_discounts == null
          ? salesNumber(todayRaw.revenue)
          : salesNumber(todayRaw.gross_sales_before_discounts),
    },
    yesterdayRevenue: salesNumber(json.yesterday_revenue),
    changePct,
    weekly: normalizeSalesPoints(json.weekly),
    weeklyTotal: salesNumber(json.weekly_total),
    monthly: normalizeSalesPoints(json.monthly),
    monthlyTotal: salesNumber(json.monthly_total),
    yearlyTotal: salesNumber(json.yearly_total),
    // Same defensive defaults for the month/year windows.
    monthlyTotalDiscounts: salesNumber(json.monthly_total_discounts),
    monthlyGrossBeforeDiscounts:
      json.monthly_gross_sales_before_discounts == null
        ? salesNumber(json.monthly_total)
        : salesNumber(json.monthly_gross_sales_before_discounts),
    yearlyTotalDiscounts: salesNumber(json.yearly_total_discounts),
    yearlyGrossBeforeDiscounts:
      json.yearly_gross_sales_before_discounts == null
        ? salesNumber(json.yearly_total)
        : salesNumber(json.yearly_gross_sales_before_discounts),
    generatedAt: typeof json.generated_at === "string" ? json.generated_at : "",
  };
}

/** Expense totals from /api/expenses and /api/expenses/summary.
 *  `stockPurchases` is optional so older backends simply omit the line. */
function normalizeExpensesSummary(raw: unknown): ExpensesSummary {
  const json = (
    raw && typeof raw === "object" ? raw : {}
  ) as Record<string, unknown>;
  const summary: ExpensesSummary = {
    total: salesNumber(json.total),
    count: salesNumber(json.count),
  };
  const stockRaw = (
    json.stockPurchases && typeof json.stockPurchases === "object"
      ? json.stockPurchases
      : null
  ) as Record<string, unknown> | null;
  if (stockRaw) {
    summary.stockPurchases = {
      total: salesNumber(stockRaw.total),
      count: salesNumber(stockRaw.count),
    };
  }
  return summary;
}

type AdminEventManager = {
  subscribe: (listener: () => void) => () => void;
};

let sharedAdminEventManager: AdminEventManager | null = null;

/**
 * One shared admin EventSource + trailing debounce for the whole portal.
 * Bursts of backend events collapse into a single notification so the
 * pages/context refresh once per burst instead of once per event.
 */
export function createAdminEventManager(): AdminEventManager {
  if (sharedAdminEventManager) return sharedAdminEventManager;

  const listeners = new Set<() => void>();
  let stopStream: (() => void) | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch {
          // A page listener must never break the shared stream.
        }
      }
    }, SALES_EVENTS_DEBOUNCE_MS);
  };

  const manager: AdminEventManager = {
    subscribe(listener) {
      listeners.add(listener);
      if (!stopStream) {
        stopStream = subscribeAdminEvents(notify);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          const stop = stopStream;
          stopStream = null;
          stop?.();
        }
      };
    },
  };

  sharedAdminEventManager = manager;
  return manager;
}


// Menu is server-backed (shared across devices) with a localStorage fallback
// for offline use. Reads are public; writes need a staff/admin token.
async function menuApi(path: string, init?: RequestInit): Promise<Response> {
  const { getApiUrl } = await import("@/lib/config");
  const token = getStaffOrAdminToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MENU_API_TIMEOUT_MS);
  try {
    return await fetch(`${getApiUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function notifyMenuSyncFailed() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eat-n-repeat:menu-sync-failed"));
  }
}

function notifyStaffSyncFailed(detail?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("eat-n-repeat:staff-sync-failed", { detail }),
    );
  }
}

// Staff accounts are server-backed (shared across devices) with a
// localStorage offline cache. DB is source of truth when reachable.
// Only core identity fields are synced; availability/lastActive stay
// device-local. Passwords are NEVER read from the server:
// GET /api/staff strips passwordHash, POST/PUT send plaintext over HTTPS
// and the backend stores bcrypt hashes.
// Writes get a longer timeout: free-tier backends (Render) can cold-start
// well past 8s, and aborting a real in-flight create is exactly how phantom
// "created here, missing everywhere else" rows happen.
const STAFF_WRITE_TIMEOUT_MS = 20000;

async function staffApi(
  path: string,
  init?: RequestInit,
  timeoutMs: number = MENU_API_TIMEOUT_MS,
): Promise<Response> {
  const { getApiUrl } = await import("@/lib/config");
  const token = getStaffOrAdminToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${getApiUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

type BackendStaffUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: StaffAccount["role"];
  status: StaffAccount["status"];
  archived?: boolean;
  createdAt?: string;
};

function toServerStaffPayload(input: StaffAccountInput) {
  // Trim identity fields: login trims the identifier before comparing, so a
  // stored "maria " or "Maria@x.com " would 401 forever on other devices.
  return {
    name: (input.name || "").trim(),
    username: (input.username || "").trim(),
    email: (input.email || "").trim(),
    ...(input.password ? { password: input.password } : {}),
    role: input.role,
    status: input.status,
    archived: false,
  };
}

function mergeServerStaff(
  prev: StaffAccount[],
  server: BackendStaffUser[],
): StaffAccount[] {
  const byId = new Map(prev.map((a) => [a.id, a]));
  const byUsername = new Map(
    prev.map((a) => [(a.username || "").toLowerCase(), a]),
  );
  const byEmail = new Map(prev.map((a) => [(a.email || "").toLowerCase(), a]));
  const serverIds = new Set(server.map((s) => s.id));
  const serverUsernames = new Set(
    server.map((s) => (s.username || "").toLowerCase()),
  );
  const serverEmails = new Set(
    server.map((s) => (s.email || "").toLowerCase()),
  );
  const merged: StaffAccount[] = server.map((s) => {
    const local =
      byId.get(s.id) ??
      byUsername.get((s.username || "").toLowerCase()) ??
      byEmail.get((s.email || "").toLowerCase());
    return {
      id: s.id,
      name: s.name,
      username: s.username,
      email: s.email,
      // Keep local hash for offline fallback when available; server rows
      // never include a password/hash in GET responses.
      password: local?.password,
      role: s.role,
      status: s.status,
      availability: local?.availability ?? "Offline",
      lastActive: local?.lastActive ?? "Never",
      createdAt: local?.createdAt ?? s.createdAt ?? new Date().toISOString(),
      archived: s.archived ?? false,
      archivedAt: local?.archivedAt,
    };
  });
  // Keep device-only rows created offline (not yet on server) alongside.
  // Never duplicate rows that already exist on the server by ID, username, or email.
  // Evict legacy mock sf-1 and Cafe Administrator placeholder.
  const offlineOnly = prev.filter((a) => {
    if (serverIds.has(a.id)) return false;
    const u = (a.username || "").toLowerCase();
    const e = (a.email || "").toLowerCase();
    if (u && serverUsernames.has(u)) return false;
    if (e && serverEmails.has(e)) return false;
    if (a.id === "sf-1" || a.name === "Cafe Administrator") return false;
    return true;
  });
  return [...merged, ...offlineOnly];
}

// ---------------------------------------------------------------------------
// Backend orders (cross-device staff visibility).
// GET /api/admin-orders returns every order row (no type/status filter on
// the backend) with its payments. Rows are split by `type`: delivery rows
// become DeliveryOrders, everything else (dine-in/pickup) RecentOrders.
// Server wins for shared rows; device-only offline rows are kept alongside.
// ---------------------------------------------------------------------------

type BackendOrderRow = {
  id: string;
  orderNumber: string;
  /* Additive (Phase 3): ordering customer's account id — passed through so
     the "Flag customer" report entry can target /api/admin/users/customers/
     :id/report. Optional; untouched rows keep working. */
  customerId?: string | null;
  customerName?: string | null;
  phone?: string | null;
  address?: string | null;
  serviceAreaId?: string | null;
  type?: string | null;
  items?: unknown;
  subtotal?: unknown;
  deliveryFee?: unknown;
  total?: unknown;
  status?: string | null;
  archived?: boolean | null;
  notes?: string | null;
  // Pick-Up / Take-Out details (server rows; null for other types).
  pickupName?: string | null;
  pickupAt?: string | null;
  createdAt?: string | null;
  deliveredAt?: string | null;
  deliveryPerson?: string | null;
  proofOfDeliveryPhoto?: string | null;
  proofOfDeliverySignature?: string | null;
  proofOfDeliveryNote?: string | null;
  proofOfDeliverySubmittedAt?: string | null;
  proofOfDeliverySubmittedBy?: string | null;
  orderMode?: string | null;
  payments?: { status?: string | null; paymentMethod?: string | null }[] | null;
};

function orderItemsSummary(raw: unknown): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return orderItemsSummary(parsed);
    } catch {
      // Plain summary string (payments checkout format) — use as-is.
    }
    return trimmed;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((entry: any) => {
        if (entry && typeof entry === "object") {
          const qty = Number(entry.quantity) || 1;
          const name = String(entry.name ?? entry.item ?? "Item");
          return `${qty}x ${name}`;
        }
        return String(entry);
      })
      .join(", ");
  }
  return "";
}

function mapStoreStatus(status: string | null | undefined): RecentOrder["status"] {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "pending";
    case "pending_payment":
      return "awaiting_payment";
    case "confirmed":
      return "confirmed";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
    case "delivered":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapDeliveryStatus(status: string | null | undefined): DeliveryStatus {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "confirmed";
    case "preparing":
      return "preparing";
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    // A delivery row the backend persisted as "completed" (staff chose
    // Completed) must survive mapping. It previously fell into default and
    // came back as "pending" on every repull/poll, making Completed revert
    // to Pending and dropping the order out of history filters.
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "pending":
    case "pending_payment":
    default:
      return "pending";
  }
}

function mapBackendOrders(rows: BackendOrderRow[]): {
  store: RecentOrder[];
  delivery: DeliveryOrder[];
} {
  const store: RecentOrder[] = [];
  const delivery: DeliveryOrder[] = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    const payments = Array.isArray(row.payments) ? row.payments : [];
    const paidPayment = payments.find((p) => String(p?.status ?? "").toUpperCase() === "PAID");
    const paid = Boolean(paidPayment);
    const paymentMethod = payments[0]?.paymentMethod ?? undefined;
    const createdAt = row.createdAt ? new Date(row.createdAt) : null;
    // Staff/Admin display in Philippine Time (Asia/Manila), date + time.
    // Customer history formats its own date independently and is untouched.
    const createdIso =
      createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : "";
    const timeLabel = createdIso ? formatPhDateTime(createdIso) : "";
    const items = orderItemsSummary(row.items);
    const total = Number(row.total);
    if ((row.type ?? "").toLowerCase() === "delivery") {
      delivery.push({
        id: row.id,
        orderNumber: row.orderNumber,
        customerId: row.customerId ?? undefined,
        customerName: row.customerName ?? "Customer",
        phone: row.phone ?? "",
        address: row.address ?? "",
        serviceAreaId: row.serviceAreaId ?? "",
        items,
        subtotal: Number(row.subtotal) || 0,
        deliveryFee: Number(row.deliveryFee) || 0,
        total: Number.isFinite(total) ? total : 0,
        status: mapDeliveryStatus(row.status),
        deliveryPerson: row.deliveryPerson ?? undefined,
        proofOfDeliveryPhoto: row.proofOfDeliveryPhoto ?? null,
        proofOfDeliverySignature: row.proofOfDeliverySignature ?? null,
        proofOfDeliveryNote: row.proofOfDeliveryNote ?? null,
        proofOfDeliverySubmittedAt: row.proofOfDeliverySubmittedAt ?? null,
        proofOfDeliverySubmittedBy: row.proofOfDeliverySubmittedBy ?? null,
        notes: typeof row.notes === "string" ? row.notes : undefined,
        orderedAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString(),
        deliveredAt: row.deliveredAt ?? undefined,
        archived: Boolean(row.archived),
        archivedAt: undefined,
      });
    } else {
      store.push({
        id: row.id,
        orderId: row.orderNumber,
        customerId: row.customerId ?? undefined,
        customerName: row.customerName ?? undefined,
        orderType: row.type ?? undefined,
        orderMode: row.orderMode ?? undefined,
        phone: row.phone ?? undefined,
        address: row.address ?? undefined,
        serviceAreaId: row.serviceAreaId ?? undefined,
        pickupName: row.pickupName ?? undefined,
        pickupAt: row.pickupAt ?? undefined,
        deliveryPerson: row.deliveryPerson ?? undefined,
        deliveredAt: row.deliveredAt ?? undefined,
        proofOfDeliveryPhoto: row.proofOfDeliveryPhoto ?? null,
        proofOfDeliverySignature: row.proofOfDeliverySignature ?? null,
        proofOfDeliveryNote: row.proofOfDeliveryNote ?? null,
        proofOfDeliverySubmittedAt: row.proofOfDeliverySubmittedAt ?? null,
        proofOfDeliverySubmittedBy: row.proofOfDeliverySubmittedBy ?? null,
        time: timeLabel,
        orderedAt: createdIso || undefined,
        items,
        total: Number.isFinite(total) ? total : 0,
        status: mapStoreStatus(row.status),
        notes: typeof row.notes === "string" ? row.notes : undefined,
        paid,
        paymentStatus: paid ? "paid" : undefined,
        paymentMethod: paymentMethod ?? undefined,
        archived: Boolean(row.archived),
        archivedAt: undefined,
      });
    }
  }
  return { store, delivery };
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  // Fallback for non-secure contexts (HTTP localhost/LAN) where crypto.randomUUID is unavailable.
  // Combines timestamp + random for uniqueness without requiring HTTPS.
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}${randomPart}`.slice(0, prefix.length + 1 + 16);
}

function archiveTimestamp() {
  return new Date().toISOString();
}

function ensureArchived<T extends { archived?: boolean }>(
  items: T[] | undefined,
  fallback: T[] = [],
): (T & { archived: boolean })[] {
  return (items ?? fallback).map((item) => ({
    ...item,
    archived: item.archived ?? false,
  }));
}

// Retired factory order mocks. Order views must render only real orders;
// these ids are dropped when cached state loads (genuine offline-created
// rows use random ids and are unaffected).
// Rows created on this device (offline/optimistic) use createId("ord"/"do")
// ids. They are the only rows safe to keep when the server response no longer
// includes them — server-origin rows (uuid ids) missing from a successful
// response were deleted server-side and must be pruned, or they stay visible
// forever as ghosts that 404 on every action.
const CLIENT_GENERATED_ROW_ID = /^(ord|do)-/i;
const LEGACY_MOCK_ORDER_IDS = new Set(["so-1", "so-2", "so-3"]);
const LEGACY_MOCK_DELIVERY_IDS = new Set([
  "do-1",
  "do-2",
  "do-3",
  "do-4",
  "do-5",
  "do-6",
]);

const LEGACY_MOCK_STOCK_IDS = new Set([
  "st-1",
  "st-2",
  "st-3",
  "st-4",
  "st-5",
  "st-6",
  "si-6f12f5bf",
]);

function normalizeStoredData(data: Partial<AdminDataState>): AdminDataState {
  return {
    ...initialAdminData,
    ...data,
    menuCategories: ensureArchived(
      data.menuCategories,
      initialAdminData.menuCategories,
    ),
    menuItems: ensureArchived(data.menuItems, initialAdminData.menuItems),
    stockCategories: data.stockCategories ?? initialAdminData.stockCategories,
    stockItems: (data.stockItems ?? []).filter(
      (i) => !LEGACY_MOCK_STOCK_IDS.has(i.id) && !i.name.includes("Test Item Sync"),
    ),
    stockRequests: data.stockRequests ?? initialAdminData.stockRequests,
    staffAccounts: ensureArchived(
      (data.staffAccounts ?? initialAdminData.staffAccounts)
        .filter((a) => a.id !== "sf-1" && a.name !== "Cafe Administrator")
        .map((account) => {
          const initial = initialAdminData.staffAccounts.find((x) => x.id === account.id);
          return {
            ...account,
            username: account.username || initial?.username || account.name.toLowerCase().replace(/\s+/g, ""),
            // Never persist plaintext: hash legacy/mock passwords on load.
            password: ensureHashed(account.password || initial?.password || "staff123"),
            role:
              (account.role as string) === "cashier" ? "staff" : account.role,
          };
        }),
      initialAdminData.staffAccounts,
    ),
    systemSettings: data.systemSettings ?? initialAdminData.systemSettings,
    deliveryOrders: ensureArchived(
      (data.deliveryOrders ?? []).filter((o) => !LEGACY_MOCK_DELIVERY_IDS.has(o.id)),
      initialAdminData.deliveryOrders,
    ),
    serviceAreas: data.serviceAreas ?? initialAdminData.serviceAreas,
    deliverySettings:
      data.deliverySettings ?? initialAdminData.deliverySettings,
    storeOrders: ensureArchived(
      // One-time eviction of the retired factory mocks (so-1/ORD-1234,
      // so-2/ORD-1230, so-3/ORD-1225): devices that cached them would
      // otherwise keep rendering fake activity forever, since the order
      // merge retains server-unknown ids by design (offline rows).
      (data.storeOrders ?? []).filter((o) => !LEGACY_MOCK_ORDER_IDS.has(o.id)),
      initialAdminData.storeOrders,
    ).map((order) => ({
      ...order,
      orderId: order.orderId ?? order.id,
    })),

  };
}

type AdminDataContextValue = AdminDataState & {
  addMenuItem: (input: MenuItemInput) => Promise<any> | void;
  updateMenuItem: (id: string, input: MenuItemInput) => Promise<any> | void;
  deleteMenuItem: (id: string) => void;
  refreshBackendMenu: () => Promise<boolean>;
  fetchStockConsistencyCheck: () => Promise<any>;
  syncMenuItemsToStock: () => Promise<any>;
  archiveMenuItem: (id: string) => void;
  restoreMenuItem: (id: string) => void;
  addMenuCategory: (input: MenuCategoryInput) => void;
  updateMenuCategory: (id: string, input: MenuCategoryInput) => void;
  deleteMenuCategory: (id: string) => boolean;
  archiveMenuCategory: (id: string) => void;
  restoreMenuCategory: (id: string) => void;
  addStockItem: (input: StockItemInput) => void;
  updateStockItem: (id: string, input: StockItemInput) => void;
  deleteStockItem: (id: string) => void;
  addStockRequest: (input: StockRequestInput) => void;
  updateStockRequestStatus: (id: string, status: StockRequest["status"], adminNote?: string) => void;
  addStockCategory: (input: StockCategoryInput) => void;
  updateStockCategory: (id: string, input: StockCategoryInput) => void;
  deleteStockCategory: (id: string) => boolean;
  addStaffAccount: (
    input: StaffAccountInput,
  ) => Promise<{ ok: boolean; message: string; offline?: boolean }>;
  updateStaffAccount: (id: string, input: StaffAccountInput) => void;
  deleteStaffAccount: (id: string) => void;
  archiveStaffAccount: (id: string) => void;
  restoreStaffAccount: (id: string) => void;
  refreshStaffAccounts: () => Promise<boolean>;
  refreshBackendOrders: () => Promise<boolean>;
  refreshBackendStock: () => Promise<boolean>;
  /** Live figures from GET /api/sales/figures (shared by dashboard/reports). */
  salesFigures: SalesFigures | null;
  /** Incremented after each debounced admin event; pages refetch scoped data. */
  salesEventsVersion: number;
  fetchSalesFigures: () => Promise<void>;
  fetchOrderHistoryPage: (args: {
    page: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => Promise<{
    store: RecentOrder[];
    delivery: DeliveryOrder[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>;
  fetchStockDashboard: () => Promise<StockDashboardResponse | null>;
  fetchStockMovementsPage: (args: {
    page: number;
    limit?: number;
    itemId?: string;
    type?: string;
    from?: string;
    to?: string;
    staffId?: string;
    search?: string;
  }) => Promise<StockMovementPage | null>;
  stockInItem: (itemId: string, input: StockInInput) => Promise<StockMutationResponse>;
  adjustStockItem: (itemId: string, input: StockAdjustInput) => Promise<StockMutationResponse>;
  fetchStockItemLayers: (itemId: string) => Promise<StockLayer[] | null>;
  /** Admin-only Phase B write: set the unit cost on one FIFO cost layer.
   *  PATCH /api/stock/items/:id/layers/:layerId/cost → on success
   *  { success: true, layer }; 400/404/409 return { success: false, message }. */
  setStockLayerCost: (
    itemId: string,
    layerId: string,
    unitCost: number,
  ) => Promise<
    { ok: true; layer: StockLayer } | { ok: false; message: string }
  >;
  migrateLocalStaffAccount: (
    id: string,
    password: string,
  ) => Promise<{ ok: boolean; message: string }>;
  staffLoading: boolean;
  staffSyncError: string | null;
  serverStaffIds: string[];
  updateSystemSettings: (settings: SystemSettings) => void;
  getMenuCategoryName: (categoryId: string) => string;
  getStockCategoryName: (categoryId: string) => string;
  getMenuItemsByCategory: (categoryId: string) => MenuItem[];
  getStockItemsByCategory: (categoryId: string) => StockItem[];
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  submitProofOfDelivery: (
    id: string,
    proof: { photo: string; signature: string; note?: string | null }
  ) => Promise<{ success: boolean; message?: string }>;
  updateDeliveryOrderPhone: (
    id: string,
    phone: string
  ) => Promise<{ success: boolean; message?: string }>;
  addDeliveryOrder: (input: DeliveryOrderInput) => void;
  deleteDeliveryOrder: (id: string) => void;
  archiveDeliveryOrder: (id: string) => void;
  restoreDeliveryOrder: (id: string) => void;
  archiveStoreOrder: (id: string) => void;
  restoreStoreOrder: (id: string) => void;
  updateStoreOrderStatus: (id: string, status: RecentOrder["status"]) => void;
  confirmStoreOrderPayment: (id: string, cashReceived?: number) => void;
  fetchActiveCashShift: () => Promise<void>;
  fetchExpenses: (args: {
    page: number;
    limit?: number;
    from?: string;
    to?: string;
    category?: string;
    paymentSource?: string;
    origin?: string;
    createdById?: string;
  }) => Promise<{
    expenses: ExpenseItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary: ExpensesSummary;
  } | null>;
  fetchExpensesSummary: (
    from?: string,
    to?: string,
  ) => Promise<ExpensesSummary | null>;
  createShiftExpense: (
    shiftId: string,
    input: { amount: number; category: string; reason: string; note?: string },
  ) => Promise<{
    ok: boolean;
    message: string;
    expense: ExpenseItem | null;
    shift: CashShift | null;
  }>;
  createAdminExpense: (
    input: {
      date?: string;
      amount: number;
      category: string;
      payee?: string;
      paymentSource: "cash_drawer" | "other" | string;
      reason: string;
      note?: string;
    },
  ) => Promise<{
    ok: boolean;
    message: string;
    expense: ExpenseItem | null;
    shift: CashShift | null;
  }>;
  voidExpense: (id: string, reason: string) => Promise<{ ok: boolean; message: string }>;
  reverseExpense: (
    id: string,
    reason: string,
  ) => Promise<{ ok: boolean; message: string; expense: ExpenseItem | null }>;
  addStoreOrder: (input: Omit<RecentOrder, "id" | "archived" | "archivedAt">) => void;
  addServiceArea: (input: ServiceAreaInput) => void;
  updateServiceArea: (id: string, input: ServiceAreaInput) => void;
  deleteServiceArea: (id: string) => boolean;
  updateDeliverySettings: (settings: DeliverySettings) => void;
  getServiceAreaName: (serviceAreaId: string) => string;
  getActiveDeliveryOrders: () => DeliveryOrder[];
  getDeliveryHistory: () => DeliveryOrder[];
  getActiveMenuItems: () => MenuItem[];
  getActiveMenuCategories: () => MenuCategory[];
  getActiveStaffAccounts: () => StaffAccount[];
  getActiveStoreOrders: () => RecentOrder[];

};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

/**
 * Sanitizes and trims AdminData before saving to browser localStorage.
 * Browser localStorage has a strict ~5MB limit per origin.
 *
 * 1. Delivery orders are online-only and saved in MySQL. Their heavy base64
 *    proof-of-delivery photos and signatures must NEVER be stored in localStorage.
 * 2. Trims deliveryOrders (max 30 recent) and storeOrders (max 50 recent).
 * 3. Keeps essential catalog, categories, addons, staff accounts, and settings intact.
 */
function prepareStoragePayload(data: AdminDataState): string {
  const sanitizedDeliveryOrders = (data.deliveryOrders || []).slice(0, 30).map((o) => {
    const isPhotoData = typeof o.proofOfDeliveryPhoto === "string" && o.proofOfDeliveryPhoto.startsWith("data:");
    const isSigData = typeof o.proofOfDeliverySignature === "string" && o.proofOfDeliverySignature.startsWith("data:");
    if (!isPhotoData && !isSigData) return o;
    return {
      ...o,
      proofOfDeliveryPhoto: isPhotoData ? null : o.proofOfDeliveryPhoto,
      proofOfDeliverySignature: isSigData ? null : o.proofOfDeliverySignature,
    };
  });

  const sanitizedStoreOrders = (data.storeOrders || []).slice(0, 50);

  const payload: AdminDataState = {
    ...data,
    deliveryOrders: sanitizedDeliveryOrders,
    storeOrders: sanitizedStoreOrders,
  };

  return JSON.stringify(payload);
}

// Synchronous first-read of the local cache, used as the lazy useState
// initializer. Previously the cache loaded in a mount effect, so every page
// first painted (and persisted!) the factory mocks — flashing stale data and
// risking a mount-time overwrite of real cached rows on slow devices.
function readStoredAdminData(): AdminDataState {
  if (typeof window === "undefined") return initialAdminData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialAdminData;

  try {
    const parsed = JSON.parse(stored) as Partial<AdminDataState>;
    // Server-synced accounts legitimately have no local password (GET
    // /api/staff never returns hashes). Only reset truly legacy data
    // missing usernames or with zero accounts.
    const hasMissingCreds =
      !parsed.staffAccounts ||
      parsed.staffAccounts.length === 0 ||
      parsed.staffAccounts.some((acc) => !acc.username);

    if (hasMissingCreds) {
      console.warn("Legacy local storage detected. Resetting to initial mock data...");
      localStorage.removeItem(STORAGE_KEY);
      return initialAdminData;
    }

    const normalized = normalizeStoredData(parsed);

    // If existing stored data is dangerously bloated (> 1.5MB), immediately clean it
    if (stored.length > 1.5 * 1024 * 1024) {
      try {
        localStorage.setItem(STORAGE_KEY, prepareStoragePayload(normalized));
      } catch {
        // Ignored during startup
      }
    }

    return normalized;
  } catch {
    return initialAdminData;
  }
}

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  // SSR-identical initial state: the server always renders initialAdminData,
  // so the first client render must match it exactly or React reports a
  // hydration mismatch (server mock vs localStorage cache). The real cached
  // state hydrates in the mount effect below (client-only), then reconciles.
  const [data, setData] = useState<AdminDataState>(initialAdminData);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSyncError, setStaffSyncError] = useState<string | null>(null);
  const [serverStaffIds, setServerStaffIds] = useState<string[]>([]);
  const [salesFigures, setSalesFigures] = useState<SalesFigures | null>(null);
  const [salesEventsVersion, setSalesEventsVersion] = useState(0);
  const salesFiguresInFlight = useRef(false);
  // Guards the persist effect below: without it, the mount-time write would
  // persist the SSR placeholder OVER the real cache before hydration reads it.
  const hydratedFromStorage = useRef(false);
  // Latest state snapshot for async flows (status PATCH + revert) that run
  // outside setData updaters and must not close over stale renders.
  const dataRef = useRef(data);
  dataRef.current = data;
  // Current route, used to scope staff/admin-only background polling (see the
  // cash-shift poll below). Purely client-side — no server render depends on it.
  const pathname = usePathname();

  // Client-only cache hydration (runs after first paint, post-hydration).
  useEffect(() => {
    setData(readStoredAdminData());
  }, []);

  useEffect(() => {
    // Skip the very first run: state is still the SSR placeholder and the
    // hydration above hasn't committed yet — writing now would clobber the
    // real cache with mock data.
    if (!hydratedFromStorage.current) return;
    try {
      const payload = prepareStoragePayload(data);
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e: any) {
      console.warn("[AdminData] Local storage write failed, attempting auto-recovery:", e);
      try {
        // Auto-recovery: prune orders & non-essentials to guarantee saving fits within quota
        const pruned: AdminDataState = {
          ...data,
          deliveryOrders: [],
          storeOrders: (data.storeOrders || []).slice(0, 15),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        return; // Successfully recovered without bothering user
      } catch (pruneErr) {
        console.error("[AdminData] Auto-recovery pruning failed:", pruneErr);
      }

      // Quota blowouts otherwise fail silently and the change looks "saved"
      // until reload. Surface it loudly; callers keep their own messaging.
      console.error("[AdminData] Local storage write failed permanently:", e);
      if (
        typeof window !== "undefined" &&
        (e?.name === "QuotaExceededError" ||
          (typeof e?.message === "string" && /quota|exceed/i.test(e.message)))
      ) {
        window.dispatchEvent(new CustomEvent("eat-n-repeat:storage-full"));
      }
    }
  }, [data]);

  // Marks hydration complete AFTER the persist guard above has run, so the
  // next data change is safe to write. Declared after the persist effect on
  // purpose: mount effects run in order (hydrate → persist-skip → flip).
  useEffect(() => {
    hydratedFromStorage.current = true;
  });

  // Pull shared menu from backend with full stock-tracking metadata if staff/admin.
  const refreshBackendMenu = useCallback(async (): Promise<boolean> => {
    try {
      const token = getStaffOrAdminToken();
      const itemsUrl = token ? "/api/menu/items?admin=true" : "/api/menu/items";
      const [catRes, itemRes] = await Promise.all([
        menuApi("/api/menu/categories"),
        menuApi(itemsUrl),
      ]);
      if (!catRes.ok || !itemRes.ok) return false;
      const catJson = await catRes.json();
      const itemJson = await itemRes.json();
      const serverCategories = ensureArchived((catJson.categories ?? []) as MenuCategory[]);
      const serverItems = ensureArchived((itemJson.items ?? []) as MenuItem[]);
      const archivedCatIds = new Set<string>(catJson.archivedIds ?? []);
      const archivedItemIds = new Set<string>(itemJson.archivedIds ?? []);
      setData((prev) => {
        const serverCatIds = new Set(serverCategories.map((c) => c.id));
        const serverItemIds = new Set(serverItems.map((i) => i.id));
        return {
          ...prev,
          menuCategories: [
            ...serverCategories,
            ...prev.menuCategories
              .filter((c) => !serverCatIds.has(c.id))
              .map((c) =>
                archivedCatIds.has(c.id)
                  ? { ...c, archived: true, archivedAt: c.archivedAt ?? archiveTimestamp() }
                  : c,
              ),
          ],
          menuItems: [
            ...serverItems,
            ...prev.menuItems
              .filter((i) => !serverItemIds.has(i.id))
              .map((i) =>
                archivedItemIds.has(i.id)
                  ? { ...i, archived: true, archivedAt: i.archivedAt ?? archiveTimestamp() }
                  : i,
              ),
          ],
        };
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshBackendMenu();
  }, [refreshBackendMenu]);

  const refreshStaffAccounts = useCallback(async (): Promise<boolean> => {
    setStaffLoading(true);
    setStaffSyncError(null);
    try {
      const res = await staffApi("/api/staff");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Not authorized (e.g. customer token or logged out) — keep cache.
          setStaffSyncError("Not authorized to load staff accounts.");
          return false;
        }
        setStaffSyncError("Could not load staff accounts from the server.");
        return false;
      }
      const json = await res.json();
      const server = (json.users ?? []) as BackendStaffUser[];
      setServerStaffIds(server.map((s) => s.id));
      setData((prev) => ({
        ...prev,
        staffAccounts: mergeServerStaff(prev.staffAccounts, server),
      }));
      return true;
    } catch {
      // Backend unreachable — keep the local cache (offline mode).
      return false;
    } finally {
      setStaffLoading(false);
    }
  }, []);

  // Load the shared staff directory from the backend once on mount when a
  // staff/admin token exists. DB wins; device-only offline rows are kept.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getStaffOrAdminToken();
    if (!token) return;
    refreshStaffAccounts();
  }, [refreshStaffAccounts]);

  // Pull shared orders (all types: dine-in/pickup/delivery) from the backend
  // so staff on another device sees orders placed anywhere. Server rows win
  // by order number; device-only offline rows are kept alongside. Silent on
  // auth/network failure (offline mode) — callers decide whether to surface.
  const refreshBackendOrders = useCallback(async (): Promise<boolean> => {
    try {
      const res = await staffApi("/api/admin-orders");
      if (!res.ok) return false;
      const json = await res.json().catch(() => null);
      const rows = (json?.orders ?? []) as BackendOrderRow[];
      if (!Array.isArray(rows)) return false;
      const { store, delivery } = mapBackendOrders(rows);
      setData((prev) => {
        const serverStoreKeys = new Set([
          ...store.map((o) => o.orderId),
          ...store.map((o) => o.id),
        ]);
        const serverDeliveryKeys = new Set([
          ...delivery.map((o) => o.orderNumber),
          ...delivery.map((o) => o.id),
        ]);
        // Server rows missing from a SUCCESSFUL response were deleted
        // server-side; only device-created rows (ord-/do- ids) are kept as
        // offline-only. Keeping server-origin rows here would leave ghosts
        // that 404 on every staff action.
        return {
          ...prev,
          storeOrders: [
            ...store,
            ...prev.storeOrders.filter(
              (o) =>
                CLIENT_GENERATED_ROW_ID.test(o.id) &&
                !serverStoreKeys.has(o.orderId) &&
                !serverStoreKeys.has(o.id),
            ),
          ],
          deliveryOrders: [
            ...delivery,
            ...prev.deliveryOrders.filter(
              (o) =>
                CLIENT_GENERATED_ROW_ID.test(o.id) &&
                !serverDeliveryKeys.has(o.orderNumber) &&
                !serverDeliveryKeys.has(o.id),
            ),
          ],
        };
      });
      return true;
    } catch {
      // Backend unreachable — keep the local cache (offline mode).
      return false;
    }
  }, []);

  // Pull shared stock data (items, categories, requests) from the backend so
  // both Admin and Staff portals stay in sync. Same offline-resilient pattern
  // as refreshBackendOrders: server rows win, device-only offline rows kept.
  const refreshBackendStock = useCallback(async (): Promise<boolean> => {
    try {
      const [catRes, itemRes, reqRes] = await Promise.all([
        staffApi("/api/stock/categories"),
        staffApi("/api/stock/items"),
        staffApi("/api/stock/requests").catch(() => null),
      ]);
      if (!catRes.ok || !itemRes.ok) return false;
      const catJson = await catRes.json().catch(() => null);
      const itemJson = await itemRes.json().catch(() => null);
      const reqJson = reqRes && reqRes.ok ? await reqRes.json().catch(() => null) : null;
      const serverCategories = (catJson?.categories ?? []) as { id: string; name: string }[];
      const serverItems = (itemJson?.items ?? []) as {
        id: string; name: string; categoryId: string;
        quantity: number; unit: string; lowStockThreshold: number;
      }[];
      const serverRequests = reqJson?.requests as any[] | undefined;
      setData((prev) => {
        return {
          ...prev,
          stockCategories: serverCategories.length > 0 ? serverCategories : prev.stockCategories,
          stockItems: serverItems,
          ...(serverRequests
            ? {
                stockRequests: serverRequests.map((r: any) => ({
                  id: r.id,
                  staffId: r.staffId,
                  staffName: r.staffName,
                  ingredientId: r.ingredientId,
                  ingredientName: r.ingredientName,
                  currentQuantity: Number(r.currentQuantity),
                  unit: r.unit ?? "",
                  threshold: Number(r.threshold),
                  message: r.message ?? "",
                  status: r.status,
                  adminNote: r.adminNote ?? "",
                  createdAt: r.createdAt ?? new Date().toISOString(),
                })),
              }
            : {}),
        };
      });
      return true;
    } catch {
      // Backend unreachable — keep the local cache (offline mode).
      return false;
    }
  }, []);

  // Live revenue bundle for the dashboard + reports pages. Admin-only on the
  // server; 401/403 stays silent (same pattern as the cash-shift fetch), and
  // concurrent callers share the in-flight request.
  const fetchSalesFigures = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (salesFiguresInFlight.current) return;
    const token = getStaffOrAdminToken();
    if (!token) return;
    // Admin-only endpoint: skip the request (and its 403 console noise) for
    // staff-role sessions; staff pages never render revenue figures.
    if (getTokenRole(token) !== "admin") return;

    salesFiguresInFlight.current = true;
    try {
      const { getApiUrl } = await import("@/lib/config");
      const res = await fetch(`${getApiUrl()}/api/sales/figures`, {
        headers: { Authorization: `Bearer ${token}` },
        // Bound every refresh so a cold backend cannot pile up requests.
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) return;
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!json?.success) return;
      setSalesFigures(normalizeSalesFigures(json));
    } catch (e: any) {
      if (e?.name === "TimeoutError" || e?.name === "AbortError") {
        console.warn("[sales-figures] Request timed out, keeping previous figures.");
      }
      // Backend unreachable — keep the last snapshot (offline mode).
    } finally {
      salesFiguresInFlight.current = false;
    }
  }, []);

  // Seed the shared figures once on mount when a staff/admin token exists.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getStaffOrAdminToken()) return;
    void fetchSalesFigures();
  }, [fetchSalesFigures]);

  // Load shared stock inventory and orders from the backend once on mount
  // when a staff/admin token exists.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getStaffOrAdminToken();
    if (!token) return;
    refreshBackendStock();
    refreshBackendOrders();
  }, [refreshBackendStock, refreshBackendOrders]);

  // Admin live-data wiring: one shared SSE connection + trailing debounce.
  // Any backend event refreshes the shared sales bundle, orders, and stock;
  // bumping the version lets each page refetch its own scoped data (e.g. the
  // reports expenses summary, which depends on the page's period dates).
  const needsAdminEvents = Boolean(pathname?.startsWith("/admin"));

  useEffect(() => {
    if (!needsAdminEvents || typeof window === "undefined") return;
    if (!getStaffOrAdminToken()) return;

    void fetchSalesFigures();
    const unsubscribe = createAdminEventManager().subscribe(() => {
      void fetchSalesFigures();
      void refreshBackendOrders();
      void refreshBackendStock();
      void refreshBackendMenu();
      setSalesEventsVersion((version) => version + 1);
    });
    return unsubscribe;
  }, [
    needsAdminEvents,
    fetchSalesFigures,
    refreshBackendOrders,
    refreshBackendStock,
    refreshBackendMenu,
  ]);

  // Tab focus / return self-heals revenue even if the SSE reconnect is still
  // pending (the reconnect itself also refetches via SUBSCRIBED).
  useEffect(() => {
    if (!needsAdminEvents || typeof window === "undefined") return;
    const refresh = () => {
      if (document.visibilityState === "visible" && getStaffOrAdminToken()) {
        void fetchSalesFigures();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [needsAdminEvents, fetchSalesFigures]);

  type OrderHistoryPage = {
    store: RecentOrder[];
    delivery: DeliveryOrder[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };

  // Server-paginated order history (completed/cancelled, newest-first).
  // Only the requested page crosses the wire. Returns null on auth/network
  // failure so callers fall back to the local lists (offline mode).
  const fetchOrderHistoryPage = useCallback(
    async (args: {
      page: number;
      limit?: number;
      search?: string;
      status?: string;
    }): Promise<OrderHistoryPage | null> => {
      try {
        const params = new URLSearchParams({
          page: String(Math.max(1, Math.floor(args.page) || 1)),
          limit: String(
            Math.min(100, Math.max(1, Math.floor(args.limit ?? 20)))
          ),
          search: (args.search ?? "").trim(),
          status:
            args.status === "completed" || args.status === "cancelled"
              ? args.status
              : "all",
        });
        const res = await staffApi(`/api/admin-orders/history?${params}`);
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        const rows = json?.orders as BackendOrderRow[] | undefined;
        const pagination = json?.pagination;
        if (!Array.isArray(rows) || !pagination) return null;
        const { store, delivery } = mapBackendOrders(rows);
        return {
          store,
          delivery,
          pagination: {
            page: Number(pagination.page) || 1,
            limit: Number(pagination.limit) || 20,
            total: Number(pagination.total) || 0,
            totalPages: Math.max(1, Number(pagination.totalPages) || 1),
          },
        };
      } catch {
        return null;
      }
    },
    []
  );

  /* ── Inventory (Phase A) — bare fetch helpers, no rows in context state ──
     Same pattern as fetchOrderHistoryPage: pages own their loading state;
     these only hit the server and normalize the response. */

  const fetchStockDashboard = useCallback(async (): Promise<StockDashboardResponse | null> => {
    try {
      const res = await staffApi("/api/stock/dashboard");
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as
        | (StockDashboardResponse & { success?: boolean })
        | null;
      if (!json?.cards || !json?.lists) return null;
      return json;
    } catch {
      // Auth/network failure — caller decides what to show (stale chip).
      return null;
    }
  }, []);

  const fetchStockMovementsPage = useCallback(
    async (args: {
      page: number;
      limit?: number;
      itemId?: string;
      type?: string;
      from?: string;
      to?: string;
      staffId?: string;
      search?: string;
    }): Promise<StockMovementPage | null> => {
      try {
        // Always send page/limit; blank filters are OMITTED instead of sent
        // as empty strings — /api/stock/movements 400s strict and "type" only
        // accepts a CSV of movement types.
        const params = new URLSearchParams({
          page: String(Math.max(1, Math.floor(args.page) || 1)),
          limit: String(Math.min(100, Math.max(1, Math.floor(args.limit ?? 20)))),
        });
        const itemId = (args.itemId ?? "").trim();
        if (itemId && itemId !== "all") params.set("itemId", itemId);
        const type = (args.type ?? "").trim();
        if (type && type !== "all") params.set("type", type);
        const from = (args.from ?? "").trim();
        if (from) params.set("from", from);
        const to = (args.to ?? "").trim();
        if (to) params.set("to", to);
        const staffId = (args.staffId ?? "").trim();
        if (staffId && staffId !== "all") params.set("staffId", staffId);
        const search = (args.search ?? "").trim();
        if (search) params.set("search", search);

        const res = await staffApi(`/api/stock/movements?${params}`);
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        const movements = json?.movements as StockMovement[] | undefined;
        const pagination = json?.pagination;
        if (!Array.isArray(movements) || !pagination) return null;
        return {
          movements,
          pagination: {
            page: Number(pagination.page) || 1,
            limit: Number(pagination.limit) || 20,
            total: Number(pagination.total) || 0,
            totalPages: Math.max(1, Number(pagination.totalPages) || 1),
          },
        };
      } catch {
        return null;
      }
    },
    []
  );

  // FIFO cost layers for one stock item (read-only). Returns null on
  // auth/network failure; [] is a valid "no layers" answer.
  const fetchStockItemLayers = useCallback(
    async (itemId: string): Promise<StockLayer[] | null> => {
      try {
        const res = await staffApi(
          `/api/stock/items/${encodeURIComponent(itemId)}/layers`
        );
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        // The endpoint returns a bare array; accept { layers: [...] } too.
        const rows = Array.isArray(json)
          ? json
          : json && Array.isArray(json.layers)
            ? json.layers
            : null;
        if (!rows) return null;
        return rows as StockLayer[];
      } catch {
        return null;
      }
    },
    []
  );

  // Phase B admin write: record/fix the unit cost on a single FIFO cost
  // layer. Follows the stockInItem/adjustStockItem pattern (staffApi PATCH
  // + JSON body + Bearer token, cold-start-friendly write timeout) but is
  // silent toward the shared stock list — the caller refreshes scoped data
  // via fetchStockDashboard()/its own layer cache. 400/404/409 surface the
  // server message; 401/403 and network failures return friendly copy.
  const setStockLayerCost = useCallback(
    async (
      itemId: string,
      layerId: string,
      unitCost: number,
    ): Promise<
      { ok: true; layer: StockLayer } | { ok: false; message: string }
    > => {
      try {
        const res = await staffApi(
          `/api/stock/items/${encodeURIComponent(itemId)}/layers/${encodeURIComponent(layerId)}/cost`,
          { method: "PATCH", body: JSON.stringify({ unitCost: Number(unitCost) }) },
          STAFF_WRITE_TIMEOUT_MS,
        );
        const json = (await res.json().catch(() => null)) as {
          success?: unknown;
          layer?: unknown;
          message?: unknown;
        } | null;
        if (res.ok && json?.success === true && json.layer && typeof json.layer === "object") {
          return { ok: true, layer: json.layer as StockLayer };
        }
        if (res.status === 401 || res.status === 403) {
          return { ok: false, message: "Admin authorization required." };
        }
        const message =
          typeof json?.message === "string" && json.message.trim()
            ? json.message
            : "Couldn't save the cost. Try again.";
        return { ok: false, message };
      } catch {
        return {
          ok: false,
          message: "Network error. Please check the connection and try again.",
        };
      }
    },
    []
  );

  // Shared normalizer for the stock-in / adjust write responses (201 →
  // { movement, item }): returns null movement when the payload is off-contract.
  function parseStockMutationResponse(json: unknown): {
    message: string;
    field?: string;
    errors?: Array<{ field: string; message: string }>;
    movement: StockMovement | null;
    item: StockMutationItemSnapshot | null;
  } {
    const raw = (json ?? {}) as {
      message?: unknown;
      field?: unknown;
      errors?: unknown;
      movement?: unknown;
      item?: unknown;
    };
    const message =
      typeof raw.message === "string" ? raw.message : "";
    const field =
      typeof raw.field === "string" ? raw.field : undefined;
    const errors =
      Array.isArray(raw.errors)
        ? (raw.errors as Array<{ field: string; message: string }>)
        : undefined;

    let movement: StockMovement | null = null;
    if (raw.movement && typeof raw.movement === "object") {
      movement = raw.movement as StockMovement;
    }
    let item: StockMutationItemSnapshot | null = null;
    if (raw.item && typeof raw.item === "object") {
      const it = raw.item as Record<string, unknown>;
      item = {
        id: String(it.id ?? ""),
        name: String(it.name ?? ""),
        quantity: Number(it.quantity ?? 0),
        unit: it.unit != null ? String(it.unit) : null,
      };
    }
    return { message, field, errors, movement, item };
  }

  const stockInItem = useCallback(
    async (
      itemId: string,
      input: StockInInput,
    ): Promise<StockMutationResponse> => {
      try {
        const body = {
          quantity: Number(input.quantity),
          unitCost: Number(input.unitCost),
          ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
          ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
          ...(input.supplier && input.supplier.trim()
            ? { supplier: input.supplier.trim() }
            : {}),
          ...(input.note && input.note.trim() ? { note: input.note.trim() } : {}),
        };
        const res = await staffApi(
          `/api/stock/items/${encodeURIComponent(itemId)}/stock-in`,
          { method: "POST", body: JSON.stringify(body) },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (res.status === 201) {
          const parsed = parseStockMutationResponse(await res.json().catch(() => null));
          if (parsed.movement) {
            // On-hand quantities changed everywhere — resync the shared list.
            refreshBackendStock();
            return { ok: true, message: "", movement: parsed.movement, item: parsed.item };
          }
          return { ok: false, message: "Stock-in failed. Try again.", movement: null, item: null };
        }
        if (res.status === 401 || res.status === 403) {
          return { ok: false, message: "Admin authorization required.", movement: null, item: null };
        }
        const parsed = parseStockMutationResponse(await res.json().catch(() => null));
        return {
          ok: false,
          message: parsed.message || "Stock-in failed. Try again.",
          field: parsed.field,
          errors: parsed.errors,
          movement: null,
          item: null,
        };
      } catch {
        return {
          ok: false,
          message: "Network error. Please check the connection and try again.",
          movement: null,
          item: null,
        };
      }
    },
    [refreshBackendStock]
  );

  const adjustStockItem = useCallback(
    async (
      itemId: string,
      input: StockAdjustInput,
    ): Promise<StockMutationResponse> => {
      try {
        const body = {
          direction: input.direction,
          quantity: Number(input.quantity),
          reason: input.reason,
          ...(input.note && input.note.trim() ? { note: input.note.trim() } : {}),
          ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
          ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
        };
        const res = await staffApi(
          `/api/stock/items/${encodeURIComponent(itemId)}/adjust`,
          { method: "POST", body: JSON.stringify(body) },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (res.status === 201) {
          const parsed = parseStockMutationResponse(await res.json().catch(() => null));
          if (parsed.movement) {
            refreshBackendStock();
            return { ok: true, message: "", movement: parsed.movement, item: parsed.item };
          }
          return { ok: false, message: "Adjustment failed. Try again.", movement: null, item: null };
        }
        if (res.status === 401 || res.status === 403) {
          return { ok: false, message: "Admin authorization required.", movement: null, item: null };
        }
        const parsed = parseStockMutationResponse(await res.json().catch(() => null));
        return {
          ok: false,
          message: parsed.message || "Adjustment failed. Try again.",
          field: parsed.field,
          errors: parsed.errors,
          movement: null,
          item: null,
        };
      } catch {
        return {
          ok: false,
          message: "Network error. Please check the connection and try again.",
          movement: null,
          item: null,
        };
      }
    },
    [refreshBackendStock]
  );

  const migrateLocalStaffAccount = useCallback(
    async (
      id: string,
      password: string,
    ): Promise<{ ok: boolean; message: string }> => {
      const local = data.staffAccounts.find((a) => a.id === id);
      if (!local)
        return { ok: false, message: "Local account not found." };
      if (serverStaffIds.includes(id))
        return { ok: true, message: "Already in the database." };
      if (!password.trim())
        return { ok: false, message: "Password is required for migration." };
      try {
        const res = await staffApi(
          "/api/staff",
          {
            method: "POST",
            body: JSON.stringify(toServerStaffPayload({ ...local, password })),
          },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (res.status === 409)
          return { ok: false, message: "Username or email already exists." };
        if (!res.ok) {
          if (res.status === 401 || res.status === 403)
            return { ok: false, message: "Admin authorization required." };
          return { ok: false, message: "Migration failed. Try again." };
        }
        const json = await res.json();
        const saved = json.user as BackendStaffUser;
        if (saved?.id) {
          setServerStaffIds((prev) =>
            prev.includes(saved.id) ? prev : [...prev, saved.id],
          );
          setData((prev) => ({
            ...prev,
            staffAccounts: prev.staffAccounts.map((a) =>
              a.id === id
                ? {
                    ...a,
                    id: saved.id,
                    name: saved.name,
                    username: saved.username,
                    email: saved.email,
                    role: saved.role,
                    status: saved.status,
                    archived: saved.archived ?? false,
                  }
                : a,
            ),
          }));
        }
        return { ok: true, message: "Migrated to the database." };
      } catch {
        return { ok: false, message: "Backend unreachable (offline mode)." };
      }
    },
    [data.staffAccounts, serverStaffIds],
  );

  const addMenuItem = useCallback(async (input: MenuItemInput) => {
    const res = await menuApi("/api/menu/items", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to add menu item." }));
      throw new Error(err.message || "Failed to add menu item.");
    }
    const json = await res.json();
    const saved = json.item as MenuItem;
    if (saved?.id) {
      setData((prev) => ({
        ...prev,
        menuItems: [...prev.menuItems.filter((i) => i.id !== saved.id), { ...saved, archived: false }],
      }));
    }
    void refreshBackendStock();
    return saved;
  }, [refreshBackendStock]);

  const updateMenuItem = useCallback(async (id: string, input: MenuItemInput) => {
    const res = await menuApi(`/api/menu/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to update menu item." }));
      throw new Error(err.message || "Failed to update menu item.");
    }
    const json = await res.json();
    const saved = json.item as MenuItem;
    if (saved?.id) {
      setData((prev) => ({
        ...prev,
        menuItems: prev.menuItems.map((item) => (item.id === id ? { ...saved, archived: false } : item)),
      }));
    }
    void refreshBackendStock();
    return saved;
  }, [refreshBackendStock]);

  const fetchStockConsistencyCheck = useCallback(async () => {
    const res = await staffApi("/api/stock/consistency-check");
    if (!res.ok) throw new Error("Consistency check failed.");
    return res.json();
  }, []);

  const syncMenuItemsToStock = useCallback(async () => {
    const res = await staffApi("/api/stock/sync-menu", {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || "Failed to sync menu items to stock.");
    }
    const result = await res.json();
    await Promise.all([refreshBackendStock(), refreshBackendMenu()]);
    return result;
  }, [refreshBackendStock, refreshBackendMenu]);

  const deleteMenuItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.filter((item) => item.id !== id),
    }));
  }, []);

  const archiveMenuItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.map((item) =>
        item.id === id
          ? { ...item, archived: true, archivedAt: archiveTimestamp() }
          : item,
      ),
    }));
    (async () => {
      try {
        const res = await menuApi(`/api/menu/items/${id}/archive`, {
          method: "POST",
        });
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyMenuSyncFailed();
        void refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const restoreMenuItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.map((item) =>
        item.id === id
          ? { ...item, archived: false, archivedAt: undefined }
          : item,
      ),
    }));
    (async () => {
      try {
        const res = await menuApi(`/api/menu/items/${id}/restore`, {
          method: "POST",
        });
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyMenuSyncFailed();
        void refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const addMenuCategory = useCallback((input: MenuCategoryInput) => {
    const tempId = createId("mc");
    setData((prev) => ({
      ...prev,
      menuCategories: [
        ...prev.menuCategories,
        { ...input, id: tempId, archived: false },
      ],
    }));
    (async () => {
      try {
        const res = await menuApi("/api/menu/categories", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) notifyMenuSyncFailed();
          return;
        }
        const json = await res.json();
        const saved = json.category as MenuCategory;
        if (!saved?.id) return;
        setData((prev) => ({
          ...prev,
          menuCategories: prev.menuCategories.map((category) =>
            category.id === tempId ? { ...saved, archived: false } : category,
          ),
        }));
      } catch {
        // Offline — the local row stays.
      }
    })();
  }, []);

  const updateMenuCategory = useCallback(
    (id: string, input: MenuCategoryInput) => {
      setData((prev) => ({
        ...prev,
        menuCategories: prev.menuCategories.map((category) =>
          category.id === id ? { ...category, ...input, id } : category,
        ),
      }));
      (async () => {
        try {
          const res = await menuApi(`/api/menu/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(input),
          });
          if (!res.ok && (res.status === 401 || res.status === 403))
            notifyMenuSyncFailed();
        } catch {
          // Offline — optimistic local change stands.
        }
      })();
    },
    [],
  );

  const deleteMenuCategory = useCallback((id: string) => {
    let deleted = false;
    setData((prev) => {
      const hasItems = prev.menuItems.some(
        (item) => item.categoryId === id && !item.archived,
      );
      if (hasItems) return prev;
      deleted = true;
      return {
        ...prev,
        menuCategories: prev.menuCategories.filter(
          (category) => category.id !== id,
        ),
      };
    });
    return deleted;
  }, []);

  const archiveMenuCategory = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      menuCategories: prev.menuCategories.map((category) =>
        category.id === id
          ? { ...category, archived: true, archivedAt: archiveTimestamp() }
          : category,
      ),
    }));
    (async () => {
      try {
        const res = await menuApi(`/api/menu/categories/${id}/archive`, {
          method: "POST",
        });
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyMenuSyncFailed();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

  const restoreMenuCategory = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      menuCategories: prev.menuCategories.map((category) =>
        category.id === id
          ? { ...category, archived: false, archivedAt: undefined }
          : category,
      ),
    }));
    (async () => {
      try {
        const res = await menuApi(`/api/menu/categories/${id}/restore`, {
          method: "POST",
        });
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyMenuSyncFailed();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

  const addStockItem = useCallback((input: StockItemInput) => {
    const localId = createId("st");
    // Optimistic local update.
    setData((prev) => ({
      ...prev,
      stockItems: [...prev.stockItems, { ...input, id: localId }],
    }));
    // Persist to backend; on success, re-pull so server id replaces localId.
    (async () => {
      try {
        const res = await staffApi("/api/stock/items", {
          method: "POST",
          body: JSON.stringify(input),
        }, STAFF_WRITE_TIMEOUT_MS);
        if (res.ok) refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const updateStockItem = useCallback((id: string, input: StockItemInput) => {
    // Optimistic local update.
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.map((item) =>
        item.id === id ? { ...input, id } : item,
      ),
    }));
    // Persist to backend.
    (async () => {
      try {
        const res = await staffApi(`/api/stock/items/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(input),
        }, STAFF_WRITE_TIMEOUT_MS);
        if (res.ok) refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const deleteStockItem = useCallback((id: string) => {
    // Optimistic local update.
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.filter((item) => item.id !== id),
    }));
    // Persist to backend.
    (async () => {
      try {
        await staffApi(`/api/stock/items/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }, STAFF_WRITE_TIMEOUT_MS);
        // No need to refresh on delete — item is already removed locally.
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);


  const addStockRequest = useCallback((input: StockRequestInput) => {
    setData((prev) => ({
      ...prev,
      stockRequests: [
        ...(prev.stockRequests ?? []),
        {
          ...input,
          id: createId("stock-request"),
          status: "Pending",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    (async () => {
      try {
        const res = await staffApi("/api/stock/requests", {
          method: "POST",
          body: JSON.stringify(input),
        }, STAFF_WRITE_TIMEOUT_MS);
        if (res.ok) refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const updateStockRequestStatus = useCallback(
    (id: string, status: StockRequest["status"], adminNote?: string) => {
      setData((prev) => ({
        ...prev,
        stockRequests: (prev.stockRequests ?? []).map((request) =>
          request.id === id ? { ...request, status, adminNote } : request,
        ),
      }));
      (async () => {
        try {
          const res = await staffApi(`/api/stock/requests/${encodeURIComponent(id)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, adminNote }),
          }, STAFF_WRITE_TIMEOUT_MS);
          if (res.ok) refreshBackendStock();
        } catch {
          // Offline — optimistic local change stands.
        }
      })();
    },
    [refreshBackendStock],
  );

  const addStockCategory = useCallback((input: StockCategoryInput) => {
    const localId = createId("sc");
    setData((prev) => ({
      ...prev,
      stockCategories: [
        ...prev.stockCategories,
        { ...input, id: localId },
      ],
    }));
    (async () => {
      try {
        const res = await staffApi("/api/stock/categories", {
          method: "POST",
          body: JSON.stringify(input),
        }, STAFF_WRITE_TIMEOUT_MS);
        if (res.ok) refreshBackendStock();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, [refreshBackendStock]);

  const updateStockCategory = useCallback(
    (id: string, input: StockCategoryInput) => {
      setData((prev) => ({
        ...prev,
        stockCategories: prev.stockCategories.map((category) =>
          category.id === id ? { ...input, id } : category,
        ),
      }));
      (async () => {
        try {
          const res = await staffApi(`/api/stock/categories/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(input),
          }, STAFF_WRITE_TIMEOUT_MS);
          if (res.ok) refreshBackendStock();
        } catch {
          // Offline — optimistic local change stands.
        }
      })();
    },
    [refreshBackendStock],
  );

  const deleteStockCategory = useCallback((id: string) => {
    let deleted = false;
    setData((prev) => {
      const hasItems = prev.stockItems.some((item) => item.categoryId === id);
      if (hasItems) return prev;
      deleted = true;
      return {
        ...prev,
        stockCategories: prev.stockCategories.filter(
          (category) => category.id !== id,
        ),
      };
    });
    if (deleted) {
      (async () => {
        try {
          await staffApi(`/api/stock/categories/${encodeURIComponent(id)}`, {
            method: "DELETE",
          }, STAFF_WRITE_TIMEOUT_MS);
        } catch {
          // Offline — optimistic local change stands.
        }
      })();
    }
    return deleted;
  }, []);

  const addStaffAccount = useCallback(
    async (
      input: StaffAccountInput,
    ): Promise<{ ok: boolean; message: string; offline?: boolean }> => {
      if (input.role === "admin") {
        return {
          ok: false,
          message: "Creating admin accounts is not allowed.",
        };
      }
      const tempId = createId("sf");
      const plainPassword = input.password || "staff123";
      const trimmed = {
        ...input,
        name: (input.name || "").trim(),
        username: (input.username || "").trim(),
        email: (input.email || "").trim(),
      };
      const secured = { ...trimmed, password: ensureHashed(plainPassword) };
      setData((prev) => ({
        ...prev,
        staffAccounts: [
          ...prev.staffAccounts,
          { ...secured, id: tempId, archived: false },
        ],
      }));
      // Persist to the shared backend (source of truth for cross-device).
      // Plaintext is sent only to the backend (HTTPS); only the hash stays local.
      // The caller MUST await this result: optimistic success toasts without it
      // are exactly how "created on Laptop A, missing on Laptop B" happens.
      try {
        const res = await staffApi(
          "/api/staff",
          {
            method: "POST",
            body: JSON.stringify(
              toServerStaffPayload({ ...trimmed, password: plainPassword }),
            ),
          },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (!res.ok) {
          if (res.status === 409) {
            // Duplicate username/email — remove the optimistic row so the
            // local cache does not diverge from the DB.
            setData((prev) => ({
              ...prev,
              staffAccounts: prev.staffAccounts.filter((a) => a.id !== tempId),
            }));
            return {
              ok: false,
              message: "Username or email already exists in the database.",
            };
          }
          if (res.status === 401 || res.status === 403) {
            // Real authorization denial (not logged in as admin, customer
            // token, expired session). Remove the phantom row: an account
            // the database rejected must not linger as a local-only login.
            setData((prev) => ({
              ...prev,
              staffAccounts: prev.staffAccounts.filter((a) => a.id !== tempId),
            }));
            notifyStaffSyncFailed();
            return {
              ok: false,
              message:
                "Not authorized. Log in as Admin (database session) and try again.",
            };
          }
          // Other HTTP errors (500, 404 from a misrouted API URL, ...):
          // remove the phantom row so Laptop A does not show an account
          // that no other device can use.
          setData((prev) => ({
            ...prev,
            staffAccounts: prev.staffAccounts.filter((a) => a.id !== tempId),
          }));
          notifyStaffSyncFailed();
          return {
            ok: false,
            message: `Database save failed (status ${res.status}). Account was not created.`,
          };
        }
        const json = await res.json();
        const saved = json.user as BackendStaffUser;
        if (!saved?.id)
          return { ok: false, message: "Database gave no account. Retry." };
        setServerStaffIds((prev) =>
          prev.includes(saved.id) ? prev : [...prev, saved.id],
        );
        setData((prev) => ({
          ...prev,
          staffAccounts: prev.staffAccounts.map((account) =>
            account.id === tempId
              ? {
                  ...account,
                  id: saved.id,
                  name: saved.name,
                  username: saved.username,
                  email: saved.email,
                  role: saved.role,
                  status: saved.status,
                  archived: saved.archived ?? false,
                }
              : account,
          ),
        }));
        return { ok: true, message: "Saved to the database." };
      } catch {
        // Backend unreachable (offline café): keep the local row as an
        // offline cache, but flag it — it will NOT work on other devices
        // until the backend is reachable and the account is recreated/synced.
        notifyStaffSyncFailed();
        return {
          ok: false,
          offline: true,
          message:
            "Backend unreachable. Saved locally only — other devices cannot use this account yet.",
        };
      }
    },
    [],
  );

  const updateStaffAccount = useCallback(
    (id: string, input: StaffAccountInput) => {
      // A bcrypt hash (or empty) means "keep existing password": never
      // re-hash a hash locally and never send a hash to the backend.
      const looksHashed =
        !!input.password && /^\$2[aby]\$/.test(input.password);
      const hasNewPassword = !!input.password && !looksHashed;
      setData((prev) => ({
        ...prev,
        staffAccounts: prev.staffAccounts.map((account) => {
          if (account.id !== id) return account;
          const { password: _omit, ...rest } = input as StaffAccountInput & {
            password?: string;
          };
          return {
            ...account,
            ...rest,
            id,
            ...(hasNewPassword && input.password
              ? { password: ensureHashed(input.password) }
              : {}),
          };
        }),
      }));
      (async () => {
        try {
          const res = await staffApi(
            `/api/staff/${id}`,
            {
              method: "PUT",
              body: JSON.stringify({
                name: input.name,
                username: input.username,
                email: input.email,
                ...(hasNewPassword ? { password: input.password } : {}),
                role: input.role,
                status: input.status,
              }),
            },
            STAFF_WRITE_TIMEOUT_MS,
          );
          if (!res.ok && (res.status === 401 || res.status === 403))
            notifyStaffSyncFailed();
        } catch {
          // Offline — optimistic local change stands.
        }
      })();
    },
    [],
  );

  const deleteStaffAccount = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      staffAccounts: prev.staffAccounts.filter((account) => account.id !== id),
    }));
    (async () => {
      try {
        const res = await staffApi(
          `/api/staff/${id}`,
          { method: "DELETE" },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyStaffSyncFailed();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

  const archiveStaffAccount = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      staffAccounts: prev.staffAccounts.map((account) =>
        account.id === id
          ? { ...account, archived: true, archivedAt: archiveTimestamp() }
          : account,
      ),
    }));
    (async () => {
      try {
        const res = await staffApi(
          `/api/staff/${id}`,
          { method: "DELETE" },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyStaffSyncFailed();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

  const restoreStaffAccount = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      staffAccounts: prev.staffAccounts.map((account) =>
        account.id === id
          ? { ...account, archived: false, archivedAt: undefined }
          : account,
      ),
    }));
    (async () => {
      try {
        const current = data.staffAccounts.find((a) => a.id === id);
        // Never send empty identity fields: the backend validates
        // name/username/email and would 400. A device-only row missing
        // those stays local until fixed.
        if (!current?.name || !current?.username || !current?.email) return;
        const res = await staffApi(
          `/api/staff/${id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: current.name,
              username: current.username,
              email: current.email,
              role: current.role ?? "staff",
              status: current.status ?? "active",
              archived: false,
            }),
          },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (!res.ok && (res.status === 401 || res.status === 403))
          notifyStaffSyncFailed();
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.staffAccounts]);

  const updateSystemSettings = useCallback((settings: SystemSettings) => {
    setData((prev) => ({ ...prev, systemSettings: settings }));
  }, []);

  const getMenuCategoryName = useCallback(
    (categoryId: string) =>
      data.menuCategories.find((category) => category.id === categoryId)?.name ??
      "Unknown",
    [data.menuCategories],
  );

  const getStockCategoryName = useCallback(
    (categoryId: string) =>
      data.stockCategories.find((category) => category.id === categoryId)
        ?.name ?? "Unknown",
    [data.stockCategories],
  );

  const getMenuItemsByCategory = useCallback(
    (categoryId: string) =>
      data.menuItems.filter(
        (item) => item.categoryId === categoryId && !item.archived,
      ),
    [data.menuItems],
  );

  const getStockItemsByCategory = useCallback(
    (categoryId: string) =>
      data.stockItems.filter((item) => item.categoryId === categoryId),
    [data.stockItems],
  );

  // Persists a staff status change to the database. The backend resolves the
  // param by DB id OR order number (findOrderByIdentifier), so both server
  // rows (uuid ids) and order-number-keyed rows work. Returns true only when
  // the database row was actually updated.
  const patchOneOrderStatus = useCallback(
    async (
      identifier: string,
      status: string,
    ): Promise<{ ok: boolean; httpStatus: number | null; notFound: boolean }> => {
      try {
        const res = await staffApi(
          `/api/admin-orders/${encodeURIComponent(identifier)}/status`,
          { method: "PATCH", body: JSON.stringify({ status }) },
          STAFF_WRITE_TIMEOUT_MS,
        );
        if (!res.ok) {
          return { ok: false, httpStatus: res.status, notFound: res.status === 404 };
        }
        const json = await res.json().catch(() => null);
        return {
          ok: json?.success === true,
          httpStatus: res.status,
          notFound: false,
        };
      } catch {
        return { ok: false, httpStatus: null, notFound: false };
      }
    },
    [],
  );

  // Client-generated row ids (createId("ord"/"do")) are unknown to the
  // server. When the direct PATCH 404s on one, retry once with the row's
  // order number, which the backend also resolves.
  const isClientRowId = (id: string) => /^(ord|do)-/i.test(id);

  const patchBackendOrderStatus = useCallback(
    async (
      id: string,
      status: string,
      fallbackIdentifier?: string,
    ): Promise<{ ok: boolean; networkError: boolean; httpStatus: number | null }> => {
      console.info(
        `[order-status] PATCH attempt id="${id}" (${isClientRowId(id) ? "client" : "server"} id) status="${status}".`,
      );
      const first = await patchOneOrderStatus(id, status);
      if (first.ok) return { ok: true, networkError: false, httpStatus: first.httpStatus };
      console.warn(
        `[order-status] PATCH id="${id}" (${isClientRowId(id) ? "client" : "server"} id)` +
          ` failed (http=${first.httpStatus ?? "network"}) — ${first.notFound ? "row unknown to server" : "server/network error"}.`,
      );
      if (first.notFound && fallbackIdentifier && fallbackIdentifier !== id) {
        console.warn(`[order-status] Retrying with order number "${fallbackIdentifier}".`);
        const second = await patchOneOrderStatus(fallbackIdentifier, status);
        if (!second.ok) {
          console.warn(
            `[order-status] Retry also failed (http=${second.httpStatus ?? "network"}).`,
          );
        }
        return {
          ok: second.ok,
          networkError: second.httpStatus === null,
          httpStatus: second.httpStatus,
        };
      }
      return {
        ok: false,
        networkError: first.httpStatus === null,
        httpStatus: first.httpStatus,
      };
    },
    [patchOneOrderStatus],
  );

  const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      const row = dataRef.current.deliveryOrders.find((o) => o.id === id);
      const prevStatus = row?.status;
      // Optimistic: staff UI updates immediately.
      setData((prev) => ({
        ...prev,
        deliveryOrders: prev.deliveryOrders.map((order) =>
          order.id === id
            ? {
                ...order,
                status,
                deliveredAt:
                  status === "delivered"
                    ? new Date().toISOString()
                    : order.deliveredAt,
              }
            : order,
        ),
      }));
      // Database is the source of truth — persist, and revert the optimistic
      // change if the API update fails so staff and customer can never
      // disagree. Failures surface on the existing staff-sync-failed channel.
      // Offline/network failures instead QUEUE the change for the sync drain
      // (priority rules applied server-side) and keep the optimistic value.
      patchBackendOrderStatus(id, status, row?.orderNumber).then(async ({ ok, networkError, httpStatus }) => {
        if (ok) {
          // Collapse the optimistic→poll window: re-pull immediately so the
          // confirmed row (and its server timestamps) replaces the guess.
          refreshBackendOrders();
          return;
        }
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        if (offline && prevStatus !== undefined) {
          setData((prev) => ({
            ...prev,
            deliveryOrders: prev.deliveryOrders.map((order) =>
              order.id === id ? { ...order, status: prevStatus } : order,
            ),
          }));
          notifyStaffSyncFailed("Delivery actions are available online only. Internet connection required.");
          return;
        }
        if (prevStatus === undefined) return;
        setData((prev) => ({
          ...prev,
          deliveryOrders: prev.deliveryOrders.map((order) =>
            order.id === id ? { ...order, status: prevStatus } : order,
          ),
        }));
        // 404 means the row no longer exists server-side: re-pull now so the
        // ghost is pruned immediately instead of on the next 10s poll.
        if (httpStatus === 404) refreshBackendOrders();
        if (httpStatus === 401 || httpStatus === 403) {
          notifyStaffSyncFailed(
            "Session expired or authentication failed. Please log in again to update order statuses.",
          );
        } else {
          notifyStaffSyncFailed(
            `Order status change to "${status}" did not reach the server — reverted. Check the browser console for details.`,
          );
        }
      });
    },
    [patchBackendOrderStatus, refreshBackendOrders],
  );

  const submitProofOfDelivery = useCallback(
    async (
      id: string,
      proof: { photo: string; signature: string; note?: string | null }
    ): Promise<{ success: boolean; message?: string }> => {
      const isOfflineNow = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOfflineNow) {
        return { success: false, message: "Delivery is available online only. Internet connection required." };
      }
      try {
        const res = await staffApi(
          `/api/delivery/orders/${id}/proof-of-delivery`,
          {
            method: "POST",
            body: JSON.stringify(proof),
          },
          25000,
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setData((prev) => ({
            ...prev,
            deliveryOrders: prev.deliveryOrders.map((order) =>
              order.id === id || order.orderNumber === id
                ? {
                    ...order,
                    status: "delivered",
                    deliveredAt: new Date().toISOString(),
                    proofOfDeliveryPhoto: proof.photo,
                    proofOfDeliverySignature: proof.signature,
                    proofOfDeliveryNote: proof.note ?? null,
                    proofOfDeliverySubmittedAt: new Date().toISOString(),
                  }
                : order
            ),
          }));
          refreshBackendOrders();
          return { success: true };
        }
        return { success: false, message: data.message || `Server error (${res.status})` };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return { success: false, message: "Request timed out. The server is still processing or offline." };
        }
        return { success: false, message: err.message || "Network error. Internet connection required." };
      }
    },
    [refreshBackendOrders],
  );

  const updateDeliveryOrderPhone = useCallback(
    async (id: string, phone: string): Promise<{ success: boolean; message?: string }> => {
      const { getApiUrl } = await import("@/lib/config");
      try {
        const token = getStaffOrAdminToken();
        const res = await fetch(`${getApiUrl()}/api/delivery/orders/${id}/phone`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setData((prev) => ({
            ...prev,
            deliveryOrders: prev.deliveryOrders.map((order) =>
              order.id === id ? { ...order, phone } : order
            ),
          }));
          refreshBackendOrders();
          return { success: true };
        }
        return { success: false, message: data.message || "Failed to update phone number." };
      } catch (err: any) {
        return { success: false, message: err.message || "Network error." };
      }
    },
    [refreshBackendOrders],
  );

  const addDeliveryOrder = useCallback((input: DeliveryOrderInput) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: [
        { ...input, id: createId("do"), archived: false },
        ...prev.deliveryOrders,
      ],
    }));
  }, []);

  const deleteDeliveryOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.filter((order) => order.id !== id),
    }));
  }, []);

  const archiveDeliveryOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((order) =>
        order.id === id
          ? { ...order, archived: true, archivedAt: archiveTimestamp() }
          : order,
      ),
    }));
  }, []);

  const restoreDeliveryOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((order) =>
        order.id === id
          ? { ...order, archived: false, archivedAt: undefined }
          : order,
      ),
    }));
  }, []);

  const archiveStoreOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id
          ? { ...order, archived: true, archivedAt: archiveTimestamp() }
          : order,
      ),
    }));
  }, []);

  const restoreStoreOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id
          ? { ...order, archived: false, archivedAt: undefined }
          : order,
      ),
    }));
  }, []);

  const updateStoreOrderStatus = useCallback((id: string, status: RecentOrder["status"]) => {
    const row = dataRef.current.storeOrders.find((o) => o.id === id);
    const prevStatus = row?.status;
    // Optimistic: staff UI updates immediately.
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id ? { ...order, status } : order
      ),
    }));
    // Database is the source of truth — persist, and revert the optimistic
    // change if the API update fails so staff and customer can never
    // disagree. Failures surface on the existing staff-sync-failed channel.
    // Offline/network failures instead QUEUE the change for the sync drain
    // (priority rules applied server-side) and keep the optimistic value.
    patchBackendOrderStatus(id, status, row?.orderId).then(async ({ ok, networkError, httpStatus }) => {
      if (ok) {
        // Collapse the optimistic→poll window: re-pull immediately so the
        // confirmed row (and its server timestamps) replaces the guess.
        refreshBackendOrders();
        return;
      }
      const offline =
        networkError || (typeof navigator !== "undefined" && !navigator.onLine);
      if (offline && prevStatus !== undefined) {
        try {
          const { journalStatusChange } = await import("@/lib/offlineSync");
          journalStatusChange({ orderId: id, fallbackIdentifier: row?.orderId ?? null, status });
        } catch {
          // Journaling must never break the UI.
        }
        console.info(
          `[order-status] offline — queued "${status}" for ${id}; replays on reconnect under server priority rules.`,
        );
        return;
      }
      if (prevStatus === undefined) return;
      setData((prev) => ({
        ...prev,
        storeOrders: prev.storeOrders.map((order) =>
          order.id === id ? { ...order, status: prevStatus } : order
        ),
      }));
      // 404 means the row no longer exists server-side: re-pull now so the
      // ghost is pruned immediately instead of on the next 10s poll.
      if (httpStatus === 404) refreshBackendOrders();
      if (httpStatus === 401 || httpStatus === 403) {
        notifyStaffSyncFailed(
          "Session expired or authentication failed. Please log in again to update order statuses.",
        );
      } else {
        notifyStaffSyncFailed(
          `Order status change to "${status}" did not reach the server — reverted. Check the browser console for details.`,
        );
      }
    });
  }, [patchBackendOrderStatus, refreshBackendOrders]);

  const confirmStoreOrderPayment = useCallback(async (id: string, cashReceived?: number) => {
    const markPaidLocally = (syncPending = false) => {
      setData((prev) => ({
        ...prev,
        storeOrders: prev.storeOrders.map((order) =>
          order.id === id ? { ...order, paid: true, paymentStatus: 'paid' as const, paymentSyncPending: syncPending || undefined } : order
        ),
      }));
    };
    // Cash collected without a server-confirmed write must still reach the
    // database: queue it for the offline drain (deduped by order id, skipped
    // server-side when the payment is already PAID).
    const queueOfflinePayment = async () => {
      try {
        const { journalPayment } = await import('@/lib/offlineSync');
        journalPayment({ orderId: id, method: 'Cash', cashReceived: cashReceived ?? null });
      } catch {
        // Journaling must never break the sale.
      }
      markPaidLocally(true);
    };
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      const response = await fetch(`${getApiUrl()}/api/admin-orders/${id}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ method: 'Cash', cashReceived })
      });
      const data = await response.json();

      if (data.success) {
        markPaidLocally();
      } else {
        // Backend rejected (or CORS-blocked in this deploy) — keep POS usable
        // and queue the collection so a later drain persists it.
        await queueOfflinePayment();
      }
      return data;
    } catch (e) {
      console.error(e);
      // Offline: record payment locally AND queue it so the drain syncs it.
      await queueOfflinePayment();
      return { success: false, message: "Network error" };
    }
  }, []);

  const fetchActiveCashShift = useCallback(async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) return;
      const res = await fetch(`${getApiUrl()}/api/cash/shift/current`, {
        headers: { Authorization: `Bearer ${token}` },
        // Bound the 10s poll: a stalled backend must not pile up hanging
        // polls behind it.
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) {
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.success) {
        const shift = data.shift as CashShift | null;
        if (shift && Array.isArray(shift.expenses)) {
          shift.expenses = normalizeExpenses(shift.expenses);
        }
        setData(prev => ({ ...prev, activeCashShift: shift }));
      }
    } catch (e: any) {
      if (e?.name === "TimeoutError" || e?.name === "AbortError") {
        console.warn("[cash-shift] Request timed out, keeping previous shift state.");
      } else {
        console.warn("[cash-shift] Backend unreachable, keeping previous shift state.", e);
      }
    }
  }, []);

  // Poll for active cash shift updates every 10 seconds — STAFF/ADMIN SURFACES
  // ONLY. activeCashShift and fetchActiveCashShift are consumed solely by the
  // staff POS (components/staff/POSCashierTab.tsx) and the admin cash page, so
  // polling from the Customer Portal only produced a staff-only request with
  // whatever token happened to sit in localStorage — typically an 8h-expired
  // staff/admin JWT — which the requireAuth-guarded endpoint answered with 401
  // every 10s. Explicit fetchActiveCashShift() callers are unaffected, and the
  // endpoint keeps its authentication.
  const needsCashShift = Boolean(
    pathname?.startsWith("/staff") || pathname?.startsWith("/admin"),
  );

  useEffect(() => {
    if (!needsCashShift) return;
    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) fetchActiveCashShift();
    }, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchActiveCashShift, needsCashShift]);

  /* ── Expenses (drawer paid-outs + admin expense log) ──
     Same bare-helper pattern as the stock endpoints: reads normalize
     server payloads, writes return result objects with the server's
     human message so pages can toast it verbatim. */

  // Shared normalizer for the three expense writes (201 → {expense, shift}).
  function parseExpenseWriteResponse(json: unknown): {
    message: string;
    expense: ExpenseItem | null;
    shift: CashShift | null;
  } {
    const raw = json as {
      message?: string;
      expense?: ExpenseItem | null;
      shift?: CashShift | null;
    } | null;
    return {
      message: typeof raw?.message === "string" ? raw.message : "",
      // mapExpense emits snake_case on the wire; surfaces read camelCase.
      expense: raw?.expense
        ? normalizeExpense(raw.expense as unknown as Record<string, unknown>)
        : null,
      shift:
        raw?.shift != null
          ? (() => {
              const s = raw.shift as CashShift;
              if (Array.isArray(s.expenses)) {
                s.expenses = normalizeExpenses(s.expenses);
              }
              return s;
            })()
          : null,
    };
  }

  const fetchExpenses = useCallback(
    async (args: {
      page: number;
      limit?: number;
      from?: string;
      to?: string;
      category?: string;
      paymentSource?: string;
      origin?: string;
      createdById?: string;
    }): Promise<{
      expenses: ExpenseItem[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      summary: ExpensesSummary;
    } | null> => {
      try {
        // Always send page/limit; blank filters are omitted — the endpoint
        // is strict about unknown/blank params (same as /api/stock/movements).
        const params = new URLSearchParams({
          page: String(Math.max(1, Math.floor(args.page) || 1)),
          limit: String(Math.min(100, Math.max(1, Math.floor(args.limit ?? 20)))),
        });
        const from = (args.from ?? "").trim();
        if (from) params.set("from", from);
        const to = (args.to ?? "").trim();
        if (to) params.set("to", to);
        const category = (args.category ?? "").trim();
        if (category) params.set("category", category);
        const paymentSource = (args.paymentSource ?? "").trim();
        if (paymentSource) params.set("paymentSource", paymentSource);
        const origin = (args.origin ?? "").trim();
        if (origin) params.set("origin", origin);
        const createdById = (args.createdById ?? "").trim();
        if (createdById) params.set("createdById", createdById);

        const res = await staffApi(`/api/expenses?${params}`);
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!Array.isArray(json?.expenses)) return null;
        const expenses = normalizeExpenses(json.expenses);
        return {
          expenses,
          page: Number(json?.page) || 1,
          limit: Number(json?.limit) || 20,
          total: Number(json?.total) || 0,
          totalPages: Math.max(1, Number(json?.totalPages) || 1),
          summary: normalizeExpensesSummary(json?.summary),
        };
      } catch {
        return null;
      }
    },
    []
  );

  const fetchExpensesSummary = useCallback(
    async (
      from?: string,
      to?: string,
    ): Promise<ExpensesSummary | null> => {
      try {
        const params = new URLSearchParams();
        if (from?.trim()) params.set("from", from.trim());
        if (to?.trim()) params.set("to", to.trim());
        const qs = params.toString();
        const res = await staffApi(`/api/expenses/summary${qs ? `?${qs}` : ""}`);
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json?.success) return null;
        return normalizeExpensesSummary(json);
      } catch {
        return null;
      }
    },
    []
  );

  // Drawer paid-out from the staff POS: 201 → refresh the active shift so
  // the shift bar and the Paid Today panel pick up the new figures/rows.
  const createShiftExpense = useCallback(
    async (
      shiftId: string,
      input: { amount: number; category: string; reason: string; note?: string },
    ): Promise<{
      ok: boolean;
      message: string;
      expense: ExpenseItem | null;
      shift: CashShift | null;
    }> => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine) {
          throw new Error("Offline");
        }
        const res = await staffApi(
          `/api/cash/shifts/${encodeURIComponent(shiftId)}/expense`,
          {
            method: "POST",
            body: JSON.stringify({
              amount: input.amount,
              category: input.category,
              reason: input.reason,
              ...(input.note ? { note: input.note } : {}),
            }),
          },
          STAFF_WRITE_TIMEOUT_MS
        );
        const parsed = parseExpenseWriteResponse(await res.json().catch(() => null));
        if (res.status === 201) {
          await fetchActiveCashShift();
          return { ok: true, message: parsed.message, expense: parsed.expense, shift: parsed.shift };
        }
        return {
          ok: false,
          message: parsed.message || "Failed to record the expense.",
          expense: null,
          shift: null,
        };
      } catch {
        // Offline / network failure: journal the drawer paid-out so it syncs with the shift
        const { journalExpense } = await import("@/lib/offlineSync");
        const expId = `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const token = getStaffOrAdminToken();
        let staffId: string | null = null;
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
            if (typeof payload?.sub === "string") staffId = payload.sub;
          } catch {}
        }
        journalExpense({
          id: expId,
          shiftId,
          amount: input.amount,
          category: input.category,
          reason: input.reason,
          note: input.note || null,
          staffId,
        });

        let updatedShift: CashShift | null = null;
        setData((prev) => {
          const currentShift = prev.activeCashShift;
          const prevExpected = Number(currentShift?.expected_cash) || 0;
          const newExpected = Math.max(0, prevExpected - input.amount);
          const newExpense: ExpenseItem = {
            id: expId,
            expenseDate: new Date().toISOString(),
            amount: input.amount,
            category: input.category,
            reason: input.reason,
            note: input.note || null,
            source: "drawer",
            paymentSource: "cash_drawer",
            status: "active",
            shiftId,
            createdAt: new Date().toISOString(),
          };
          const existingExpenses = Array.isArray(currentShift?.expenses) ? currentShift.expenses : [];
          updatedShift = {
            ...(currentShift || {
              id: shiftId,
              starting_float: 0,
              status: "open",
            }),
            expected_cash: newExpected,
            expenses: [...existingExpenses, newExpense],
          } as CashShift;
          return {
            ...prev,
            activeCashShift: updatedShift,
          };
        });

        return {
          ok: true,
          message: "Expense saved offline — will sync with shift.",
          expense: {
            id: expId,
            expenseDate: new Date().toISOString(),
            amount: input.amount,
            category: input.category,
            reason: input.reason,
            note: input.note || null,
            source: "drawer",
            paymentSource: "cash_drawer",
            status: "active",
            shiftId,
            createdAt: new Date().toISOString(),
          },
          shift: updatedShift,
        };
      }
    },
    [fetchActiveCashShift]
  );

  const createAdminExpense = useCallback(
    async (input: {
      date?: string;
      amount: number;
      category: string;
      payee?: string;
      paymentSource: "cash_drawer" | "other" | string;
      reason: string;
      note?: string;
    }): Promise<{
      ok: boolean;
      message: string;
      expense: ExpenseItem | null;
      shift: CashShift | null;
    }> => {
      try {
        const body: Record<string, unknown> = {
          amount: input.amount,
          category: input.category,
          paymentSource: input.paymentSource,
          reason: input.reason,
        };
        if (input.date?.trim()) body.date = input.date.trim();
        if (input.payee?.trim()) body.payee = input.payee.trim();
        if (input.note?.trim()) body.note = input.note.trim();

        const res = await staffApi(
          "/api/expenses",
          { method: "POST", body: JSON.stringify(body) },
          STAFF_WRITE_TIMEOUT_MS
        );
        const parsed = parseExpenseWriteResponse(await res.json().catch(() => null));
        if (res.status === 201) {
          return { ok: true, message: parsed.message, expense: parsed.expense, shift: parsed.shift };
        }
        return {
          ok: false,
          message: parsed.message || "Failed to record the expense.",
          expense: null,
          shift: null,
        };
      } catch {
        return {
          ok: false,
          message: "Network error — expense not recorded.",
          expense: null,
          shift: null,
        };
      }
    },
    []
  );

  const voidExpense = useCallback(
    async (id: string, reason: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const res = await staffApi(
          `/api/expenses/${encodeURIComponent(id)}/void`,
          { method: "POST", body: JSON.stringify({ reason }) },
          STAFF_WRITE_TIMEOUT_MS
        );
        const json = await res.json().catch(() => null);
        if (res.ok) {
          return { ok: true, message: typeof json?.message === "string" ? json.message : "Expense voided." };
        }
        return {
          ok: false,
          message: (typeof json?.message === "string" && json.message) || "Failed to void the expense.",
        };
      } catch {
        return { ok: false, message: "Network error — expense not voided." };
      }
    },
    []
  );

  // Reverse a drawer paid-out (admin-side correction): 201 → refresh the
  // shift it belongs to when we can see it via the active-shift shape.
  const reverseExpense = useCallback(
    async (
      id: string,
      reason: string,
    ): Promise<{ ok: boolean; message: string; expense: ExpenseItem | null }> => {
      try {
        const res = await staffApi(
          `/api/expenses/${encodeURIComponent(id)}/reverse`,
          { method: "POST", body: JSON.stringify({ reason }) },
          STAFF_WRITE_TIMEOUT_MS
        );
        const json = await res.json().catch(() => null);
        if (res.ok) {
          return {
            ok: true,
            message: (typeof json?.message === "string" && json.message) || "Expense reversed.",
            expense: (json?.expense as ExpenseItem) ?? null,
          };
        }
        return {
          ok: false,
          message: (typeof json?.message === "string" && json.message) || "Failed to reverse the expense.",
          expense: null,
        };
      } catch {
        return { ok: false, message: "Network error — expense not reversed.", expense: null };
      }
    },
    []
  );

  const addStoreOrder = useCallback((input: Omit<RecentOrder, "id" | "archived" | "archivedAt">) => {
    setData((prev) => ({
      ...prev,
      storeOrders: [
        ...prev.storeOrders,
        { ...input, id: createId("ord"), archived: false },
      ],
    }));
  }, []);

  const addServiceArea = useCallback((input: ServiceAreaInput) => {
    setData((prev) => ({
      ...prev,
      serviceAreas: [...prev.serviceAreas, { ...input, id: createId("sa") }],
    }));
  }, []);

  const updateServiceArea = useCallback(
    (id: string, input: ServiceAreaInput) => {
      setData((prev) => ({
        ...prev,
        serviceAreas: prev.serviceAreas.map((area) =>
          area.id === id ? { ...input, id } : area,
        ),
      }));
    },
    [],
  );

  const deleteServiceArea = useCallback((id: string) => {
    let deleted = false;
    setData((prev) => {
      const hasOrders = prev.deliveryOrders.some(
        (order) => order.serviceAreaId === id,
      );
      if (hasOrders) return prev;
      deleted = true;
      return {
        ...prev,
        serviceAreas: prev.serviceAreas.filter((area) => area.id !== id),
      };
    });
    return deleted;
  }, []);

  const updateDeliverySettings = useCallback((settings: DeliverySettings) => {
    setData((prev) => ({ ...prev, deliverySettings: settings }));
  }, []);

  const getServiceAreaName = useCallback(
    (serviceAreaId: string) =>
      data.serviceAreas.find((area) => area.id === serviceAreaId)?.name ??
      "Unknown",
    [data.serviceAreas],
  );

  const getActiveDeliveryOrders = useCallback(
    () =>
      data.deliveryOrders.filter(
        (order) =>
          !order.archived &&
          ["pending", "confirmed", "preparing", "out_for_delivery"].includes(
            order.status,
          ),
      ),
    [data.deliveryOrders],
  );

  const getDeliveryHistory = useCallback(
    () =>
      data.deliveryOrders.filter(
        (order) =>
          !order.archived &&
          ["delivered", "completed", "cancelled"].includes(order.status),
      ),
    [data.deliveryOrders],
  );

  const getActiveMenuItems = useCallback(
    () => data.menuItems.filter((item) => !item.archived),
    [data.menuItems],
  );

  const getActiveMenuCategories = useCallback(
    () => data.menuCategories.filter((category) => !category.archived),
    [data.menuCategories],
  );

  const getActiveStaffAccounts = useCallback(
    () => data.staffAccounts.filter((account) => !account.archived),
    [data.staffAccounts],
  );

  const getActiveStoreOrders = useCallback(
    () => data.storeOrders.filter((order) => !order.archived),
    [data.storeOrders],
  );



  const value = useMemo<AdminDataContextValue>(
    () => ({
      ...data,
      staffLoading,
      staffSyncError,
      serverStaffIds,
      refreshStaffAccounts,
      refreshBackendOrders,
      refreshBackendStock,
      salesFigures,
      salesEventsVersion,
      fetchSalesFigures,
      fetchOrderHistoryPage,
      migrateLocalStaffAccount,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      refreshBackendMenu,
      fetchStockConsistencyCheck,
      syncMenuItemsToStock,
      archiveMenuItem,
      restoreMenuItem,
      addMenuCategory,
      updateMenuCategory,
      deleteMenuCategory,
      archiveMenuCategory,
      restoreMenuCategory,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      addStockRequest,
      updateStockRequestStatus,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      addStaffAccount,
      updateStaffAccount,
      deleteStaffAccount,
      archiveStaffAccount,
      restoreStaffAccount,
      updateSystemSettings,
      getMenuCategoryName,
      getStockCategoryName,
      getMenuItemsByCategory,
      getStockItemsByCategory,
      updateDeliveryStatus,
      submitProofOfDelivery,
      updateDeliveryOrderPhone,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      fetchActiveCashShift,
      fetchExpenses,
      fetchExpensesSummary,
      createShiftExpense,
      createAdminExpense,
      voidExpense,
      reverseExpense,
      fetchStockDashboard,
      fetchStockMovementsPage,
      fetchStockItemLayers,
      setStockLayerCost,
      stockInItem,
      adjustStockItem,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      updateDeliverySettings,
      getServiceAreaName,
      getActiveDeliveryOrders,
      getDeliveryHistory,
      getActiveMenuItems,
      getActiveMenuCategories,
      getActiveStaffAccounts,
      getActiveStoreOrders,

    }),
    [
      data,
      staffLoading,
      staffSyncError,
      serverStaffIds,
      refreshStaffAccounts,
      refreshBackendOrders,
      refreshBackendStock,
      salesFigures,
      salesEventsVersion,
      fetchSalesFigures,
      fetchStockDashboard,
      fetchStockMovementsPage,
      fetchStockItemLayers,
      setStockLayerCost,
      stockInItem,
      adjustStockItem,
      migrateLocalStaffAccount,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      refreshBackendMenu,
      fetchStockConsistencyCheck,
      syncMenuItemsToStock,
      archiveMenuItem,
      restoreMenuItem,
      addMenuCategory,
      updateMenuCategory,
      deleteMenuCategory,
      archiveMenuCategory,
      restoreMenuCategory,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      addStockRequest,
      updateStockRequestStatus,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      addStaffAccount,
      updateStaffAccount,
      deleteStaffAccount,
      archiveStaffAccount,
      restoreStaffAccount,
      updateSystemSettings,
      getMenuCategoryName,
      getStockCategoryName,
      getMenuItemsByCategory,
      getStockItemsByCategory,
      updateDeliveryStatus,
      submitProofOfDelivery,
      updateDeliveryOrderPhone,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      fetchActiveCashShift,
      fetchExpenses,
      fetchExpensesSummary,
      createShiftExpense,
      createAdminExpense,
      voidExpense,
      reverseExpense,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      updateDeliverySettings,
      getServiceAreaName,
      getActiveDeliveryOrders,
      getDeliveryHistory,
      getActiveMenuItems,
      getActiveMenuCategories,
      getActiveStaffAccounts,
      getActiveStoreOrders,

    ],
  );

  return (
    <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return context;
}
