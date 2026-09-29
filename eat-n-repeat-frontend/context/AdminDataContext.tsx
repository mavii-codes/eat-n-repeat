"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { initialAdminData } from "@/lib/admin/mock-data";
import { ensureHashed } from "@/lib/admin/password";
import type {
  AdminDataState,
  DeliveryOrder,
  DeliveryOrderInput,
  DeliverySettings,
  DeliveryStatus,
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  RecentOrder,
  ServiceArea,
  ServiceAreaInput,
  StaffAccount,
  StaffAccountInput,
  StockCategory,
  StockCategoryInput,
  StockItem,
  StockItemInput,
  StockRequest,
  StockRequestInput,
  SystemSettings,
} from "@/lib/admin/types";

const STORAGE_KEY = "eat-n-repeat-admin-data";
const MENU_API_TIMEOUT_MS = 8000;

// Menu is server-backed (shared across devices) with a localStorage fallback
// for offline use. Reads are public; writes need a staff/admin token.
async function menuApi(path: string, init?: RequestInit): Promise<Response> {
  const { getApiUrl } = await import("@/lib/config");
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("eat-n-repeat-admin-token") ||
        localStorage.getItem("eat-n-repeat-staff-token")
      : null;
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
// Only core identity fields are synced; availability/contactNumber/
// lastActive stay device-local. Passwords are NEVER read from the server:
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
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("eat-n-repeat-admin-token") ||
        localStorage.getItem("eat-n-repeat-staff-token")
      : null;
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
      contactNumber: local?.contactNumber ?? "",
      lastActive: local?.lastActive ?? "Never",
      createdAt: local?.createdAt ?? s.createdAt ?? new Date().toISOString(),
      archived: s.archived ?? false,
      archivedAt: local?.archivedAt,
    };
  });
  // Keep device-only rows created offline (not yet on server) alongside.
  const offlineOnly = prev.filter((a) => !serverIds.has(a.id));
  return [...merged, ...offlineOnly];
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
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
    stockItems: data.stockItems ?? initialAdminData.stockItems,
    stockRequests: data.stockRequests ?? initialAdminData.stockRequests,
    staffAccounts: ensureArchived(
      (data.staffAccounts ?? initialAdminData.staffAccounts).map((account) => {
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
      data.deliveryOrders,
      initialAdminData.deliveryOrders,
    ),
    serviceAreas: data.serviceAreas ?? initialAdminData.serviceAreas,
    deliverySettings:
      data.deliverySettings ?? initialAdminData.deliverySettings,
    storeOrders: ensureArchived(
      data.storeOrders,
      initialAdminData.storeOrders,
    ).map((order) => ({
      ...order,
      orderId: order.orderId ?? order.id,
    })),

  };
}

type AdminDataContextValue = AdminDataState & {
  addMenuItem: (input: MenuItemInput) => void;
  updateMenuItem: (id: string, input: MenuItemInput) => void;
  deleteMenuItem: (id: string) => void;
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
  addDeliveryOrder: (input: DeliveryOrderInput) => void;
  deleteDeliveryOrder: (id: string) => void;
  archiveDeliveryOrder: (id: string) => void;
  restoreDeliveryOrder: (id: string) => void;
  archiveStoreOrder: (id: string) => void;
  restoreStoreOrder: (id: string) => void;
  updateStoreOrderStatus: (id: string, status: "pending" | "completed" | "cancelled") => void;
  confirmStoreOrderPayment: (id: string, cashReceived?: number) => void;
  fetchActiveCashShift: () => Promise<void>;
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

    return normalizeStoredData(parsed);
  } catch {
    return initialAdminData;
  }
}

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AdminDataState>(readStoredAdminData);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSyncError, setStaffSyncError] = useState<string | null>(null);
  const [serverStaffIds, setServerStaffIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e: any) {
      // Quota blowouts otherwise fail silently and the change looks "saved"
      // until reload. Surface it loudly; callers keep their own messaging.
      console.error("[AdminData] Local storage write failed:", e);
      if (
        typeof window !== "undefined" &&
        (e?.name === "QuotaExceededError" ||
          (typeof e?.message === "string" && /quota|exceed/i.test(e.message)))
      ) {
        window.dispatchEvent(new CustomEvent("eat-n-repeat:storage-full"));
      }
    }
  }, [data]);

  // Load the shared menu from the backend once on mount. Server rows win for
  // matching ids; device-only rows (created offline) are kept alongside.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, itemRes] = await Promise.all([
          menuApi("/api/menu/categories"),
          menuApi("/api/menu/items"),
        ]);
        if (!catRes.ok || !itemRes.ok) return;
        const catJson = await catRes.json();
        const itemJson = await itemRes.json();
        if (cancelled) return;
        const serverCategories = ensureArchived(
          (catJson.categories ?? []) as MenuCategory[],
        );
        const serverItems = ensureArchived(
          (itemJson.items ?? []) as MenuItem[],
        );
        // Tombstones: ids the server reports as archived. Cached rows with
        // these ids were removed on another device — mark them archived in
        // place (kept for offline cache, hidden from customer views). Rows
        // absent from BOTH lists are genuine offline-created rows and stay.
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
      } catch {
        // Backend unreachable — keep the local cache (offline mode).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const token =
      localStorage.getItem("eat-n-repeat-admin-token") ||
      localStorage.getItem("eat-n-repeat-staff-token");
    if (!token) return;
    refreshStaffAccounts();
  }, [refreshStaffAccounts]);

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

  const addMenuItem = useCallback((input: MenuItemInput) => {
    const tempId = createId("mi");
    setData((prev) => ({
      ...prev,
      menuItems: [...prev.menuItems, { ...input, id: tempId, archived: false }],
    }));
    // Persist to the shared backend; reconcile the temp id on success.
    (async () => {
      try {
        const res = await menuApi("/api/menu/items", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) notifyMenuSyncFailed();
          return;
        }
        const json = await res.json();
        const saved = json.item as MenuItem;
        if (!saved?.id) return;
        setData((prev) => ({
          ...prev,
          menuItems: prev.menuItems.map((item) =>
            item.id === tempId ? { ...saved, archived: false } : item,
          ),
        }));
      } catch {
        // Offline — the local row stays and syncs on next edit/reload.
      }
    })();
  }, []);

  const updateMenuItem = useCallback((id: string, input: MenuItemInput) => {
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.map((item) =>
        item.id === id ? { ...item, ...input, id } : item,
      ),
    }));
    (async () => {
      try {
        const res = await menuApi(`/api/menu/items/${id}`, {
          method: "PUT",
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          // Unknown to the server (device-only row) — create it instead.
          if (res.status === 404) {
            const createRes = await menuApi("/api/menu/items", {
              method: "POST",
              body: JSON.stringify(input),
            });
            if (!createRes.ok) {
              if (createRes.status === 401 || createRes.status === 403)
                notifyMenuSyncFailed();
              return;
            }
            const json = await createRes.json();
            const saved = json.item as MenuItem;
            if (!saved?.id) return;
            setData((prev) => ({
              ...prev,
              menuItems: prev.menuItems.map((item) =>
                item.id === id ? { ...saved, archived: false } : item,
              ),
            }));
            return;
          }
          if (res.status === 401 || res.status === 403) notifyMenuSyncFailed();
          return;
        }
        const json = await res.json();
        const saved = json.item as MenuItem;
        if (!saved?.id) return;
        setData((prev) => ({
          ...prev,
          menuItems: prev.menuItems.map((item) =>
            item.id === id ? { ...saved } : item,
          ),
        }));
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

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
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

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
      } catch {
        // Offline — optimistic local change stands.
      }
    })();
  }, []);

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
    setData((prev) => ({
      ...prev,
      stockItems: [...prev.stockItems, { ...input, id: createId("st") }],
    }));
  }, []);

  const updateStockItem = useCallback((id: string, input: StockItemInput) => {
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.map((item) =>
        item.id === id ? { ...input, id } : item,
      ),
    }));
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.filter((item) => item.id !== id),
    }));
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
  }, []);

  const updateStockRequestStatus = useCallback(
    (id: string, status: StockRequest["status"], adminNote?: string) => {
      setData((prev) => ({
        ...prev,
        stockRequests: (prev.stockRequests ?? []).map((request) =>
          request.id === id ? { ...request, status, adminNote } : request,
        ),
      }));
    },
    [],
  );

  const addStockCategory = useCallback((input: StockCategoryInput) => {
    setData((prev) => ({
      ...prev,
      stockCategories: [
        ...prev.stockCategories,
        { ...input, id: createId("sc") },
      ],
    }));
  }, []);

  const updateStockCategory = useCallback(
    (id: string, input: StockCategoryInput) => {
      setData((prev) => ({
        ...prev,
        stockCategories: prev.stockCategories.map((category) =>
          category.id === id ? { ...input, id } : category,
        ),
      }));
    },
    [],
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
    return deleted;
  }, []);

  const addStaffAccount = useCallback(
    async (
      input: StaffAccountInput,
    ): Promise<{ ok: boolean; message: string; offline?: boolean }> => {
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

  const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
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
    },
    [],
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

  const updateStoreOrderStatus = useCallback((id: string, status: "pending" | "completed" | "cancelled") => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id ? { ...order, status } : order
      ),
    }));
  }, []);

  const confirmStoreOrderPayment = useCallback(async (id: string, cashReceived?: number) => {
    const markPaidLocally = () => {
      setData((prev) => ({
        ...prev,
        storeOrders: prev.storeOrders.map((order) =>
          order.id === id ? { ...order, paid: true, paymentStatus: 'paid' as const } : order
        ),
      }));
    };
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
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
        // Backend rejected (or CORSblocked in this deploy) — keep POS usable offline.
        markPaidLocally();
      }
      return data;
    } catch (e) {
      console.error(e);
      // Offline: record payment locally so it syncs later.
      markPaidLocally();
      return { success: false, message: "Network error" };
    }
  }, []);

  const fetchActiveCashShift = useCallback(async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      if (!token) return;
      const res = await fetch(`${getApiUrl()}/api/cash/shift/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setData(prev => ({ ...prev, activeCashShift: data.shift }));
      }
    } catch (e) { console.error("Error fetching cash shift", e); }
  }, []);

  // Poll for active cash shift updates every 10 seconds
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) fetchActiveCashShift();
    }, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchActiveCashShift]);

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
          ["delivered", "cancelled"].includes(order.status),
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
      migrateLocalStaffAccount,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
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
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      fetchActiveCashShift,
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
      migrateLocalStaffAccount,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
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
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      fetchActiveCashShift,
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
