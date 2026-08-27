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
import type {
  AdminDataState,
  DeliveryOrder,
  DeliveryOrderInput,
  AvailabilityStatus,
  DeliveryTeamMember,
  AssignmentLogEntry,
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
  StockHistoryLog,
  SystemSettings,
} from "@/lib/admin/types";

const STORAGE_KEY = "eat-n-repeat-admin-data";

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
    staffAccounts: ensureArchived(
      (data.staffAccounts ?? initialAdminData.staffAccounts).map((account) => {
        const initial = initialAdminData.staffAccounts.find((x) => x.id === account.id);
        return {
          ...account,
          username: account.username || initial?.username || account.name.toLowerCase().replace(/\s+/g, ""),
          password: account.password || initial?.password || "staff123",
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
    serviceAreas: ensureArchived(
      data.serviceAreas,
      initialAdminData.serviceAreas,
    ),
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

type AdminDataContextValue = AdminDataState & {  addMenuItem: (input: MenuItemInput) => void;
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
  archiveStockItem: (id: string) => void;
  addStockCategory: (input: StockCategoryInput) => void;
  updateStockCategory: (id: string, input: StockCategoryInput) => void;
  deleteStockCategory: (id: string) => boolean;
  archiveStockCategory: (id: string) => void;
  addStaffAccount: (input: StaffAccountInput) => void;
  updateStaffAccount: (id: string, input: StaffAccountInput) => void;
  deleteStaffAccount: (id: string) => void;
  archiveStaffAccount: (id: string) => void;
  restoreStaffAccount: (id: string) => void;
  updateSystemSettings: (settings: SystemSettings) => void;
  getMenuCategoryName: (categoryId: string) => string;
  getStockCategoryName: (categoryId: string) => string;
  getMenuItemsByCategory: (categoryId: string) => MenuItem[];
  getStockItemsByCategory: (categoryId: string) => StockItem[];
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDeliveryPerson: (id: string, person: string) => void;
  updateDeliveryTeamMemberStatus: (id: string, status: AvailabilityStatus) => void;
  reassignDeliveryOrder: (orderId: string, newPersonId: string, reassignNote?: string) => void;
  addStockRequest: (input: StockRequestInput) => void;
  updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;
  addDeliveryOrder: (input: DeliveryOrderInput) => void;
  deleteDeliveryOrder: (id: string) => void;
  archiveDeliveryOrder: (id: string) => void;
  restoreDeliveryOrder: (id: string) => void;
  archiveStoreOrder: (id: string) => void;
  restoreStoreOrder: (id: string) => void;
  updateStoreOrderStatus: (id: string, status: "completed" | "cancelled") => void;
  confirmStoreOrderPayment: (id: string) => void;
  addStoreOrder: (input: any) => void;
  addServiceArea: (input: ServiceAreaInput) => void;
  updateServiceArea: (id: string, input: ServiceAreaInput) => void;
  deleteServiceArea: (id: string) => void;
  archiveServiceArea: (id: string) => void;
  restoreServiceArea: (id: string) => void;
  updateDeliverySettings: (settings: DeliverySettings) => void;
  getServiceAreaName: (id: string) => string;
  getActiveDeliveryOrders: () => DeliveryOrder[];
  getDeliveryHistory: () => DeliveryOrder[];
  getActiveMenuItems: () => MenuItem[];
  getActiveMenuCategories: () => MenuCategory[];
  getActiveStaffAccounts: () => StaffAccount[];
  getActiveStoreOrders: () => RecentOrder[];
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AdminDataState>(initialAdminData);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<AdminDataState>;
      const hasMissingCreds =
        !parsed.staffAccounts ||
        parsed.staffAccounts.length === 0 ||
        parsed.staffAccounts.some((acc) => !acc.username || !acc.password);

      if (hasMissingCreds) {
        console.warn("Legacy local storage detected. Resetting to initial mock data...");
        localStorage.removeItem(STORAGE_KEY);
        setData(initialAdminData);
        return;
      }

      setData(normalizeStoredData(parsed));
    } catch {
      setData(initialAdminData);
    }
  }, []);

  // Listen to cross-tab storage changes to keep customer and admin portals in sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<AdminDataState>;
          setData(normalizeStoredData(parsed));
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Poll live orders from the database
  useEffect(() => {
    let mounted = true;
    const fetchOrders = async () => {
      try {
        const { getApiUrl } = await import('@/lib/config');
        const token = localStorage.getItem('eat-n-repeat-staff-token');
        const response = await fetch(`${getApiUrl()}/api/admin-orders`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.orders && mounted) {
          setData(prev => {
            const liveDeliveryOrders = [];
            const liveStoreOrders = [];

            result.orders.forEach((o) => {
              if (o.type === 'delivery') {
                liveDeliveryOrders.push({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  customerName: o.customerName,
                  phone: o.phone,
                  address: o.address,
                  serviceAreaId: o.serviceAreaId,
                  items: o.items,
                  subtotal: o.subtotal,
                  deliveryFee: o.deliveryFee,
                  total: o.total,
                  status: o.status,
                  deliveryPerson: o.deliveryPerson,
                  assignedRole: o.assignedRole,
                  orderedAt: o.orderedAt,
                  archived: o.archived,
                  paymentStatus: o.paymentStatus,
                  paid: o.paymentStatus === 'paid'
                });
              } else {
                liveStoreOrders.push({
                  id: o.id,
                  orderId: o.orderNumber,
                  time: new Date(o.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  items: `${o.customerName} (${o.type === 'dine-in' ? 'Dine-In' : 'Pick-Up'}): ${o.items}`,
                  total: o.total,
                  status: o.status === 'pending' || o.status === 'preparing' ? 'pending' : (o.status === 'delivered' || o.status === 'completed' ? 'completed' : 'cancelled'),
                  paid: o.paymentStatus === 'paid',
                  archived: o.archived
                });
              }
            });

            return {
              ...prev,
              deliveryOrders: liveDeliveryOrders,
              storeOrders: liveStoreOrders
            };
          });
        }
      } catch (e) {}
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addMenuItem = useCallback((input: MenuItemInput) => {
    setData((prev) => ({
      ...prev,
      menuItems: [
        ...prev.menuItems,
        { ...input, id: createId("mi"), archived: false },
      ],
    }));
  }, []);

  const updateMenuItem = useCallback((id: string, input: MenuItemInput) => {
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.map((item) =>
        item.id === id ? { ...item, ...input, id } : item,
      ),
    }));
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
  }, []);

  const addMenuCategory = useCallback((input: MenuCategoryInput) => {
    setData((prev) => ({
      ...prev,
      menuCategories: [
        ...prev.menuCategories,
        { ...input, id: createId("mc"), archived: false },
      ],
    }));
  }, []);

  const updateMenuCategory = useCallback(
    (id: string, input: MenuCategoryInput) => {
      setData((prev) => ({
        ...prev,
        menuCategories: prev.menuCategories.map((category) =>
          category.id === id ? { ...category, ...input, id } : category,
        ),
      }));
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

  const addStaffAccount = useCallback((input: StaffAccountInput) => {
    setData((prev) => ({
      ...prev,
      staffAccounts: [
        ...prev.staffAccounts,
        { ...input, id: createId("sf"), archived: false },
      ],
    }));
  }, []);

  const updateStaffAccount = useCallback(
    (id: string, input: StaffAccountInput) => {
      setData((prev) => ({
        ...prev,
        staffAccounts: prev.staffAccounts.map((account) =>
          account.id === id ? { ...account, ...input, id } : account,
        ),
      }));
    },
    [],
  );

  const deleteStaffAccount = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      staffAccounts: prev.staffAccounts.filter((account) => account.id !== id),
    }));
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
  }, []);

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
    async (id: string, status: DeliveryStatus) => {
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

      try {
        const { getApiUrl } = await import('@/lib/config');
        const token = localStorage.getItem('eat-n-repeat-staff-token');
        await fetch(`${getApiUrl()}/api/admin-orders/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ status })
        });
      } catch (e) { console.error(e); }
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

  const updateStoreOrderStatus = useCallback(async (id: string, status: "pending" | "completed" | "cancelled") => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id ? { ...order, status } : order
      ),
    }));

    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      await fetch(`${getApiUrl()}/api/admin-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status })
      });
    } catch (e) { console.error(e); }
  }, []);

  const confirmStoreOrderPayment = useCallback(async (id: string) => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id ? { ...order, paid: true } : order
      ),
    }));

    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      await fetch(`${getApiUrl()}/api/admin-orders/${id}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
    } catch (e) { console.error(e); }
  }, []);

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
      serviceAreas: [...prev.serviceAreas, { ...input, id: createId("sa"), archived: false }],
    }));
  }, []);

  const updateServiceArea = useCallback(
    (id: string, input: ServiceAreaInput) => {
      setData((prev) => ({
        ...prev,
        serviceAreas: prev.serviceAreas.map((area) =>
          area.id === id ? { ...area, ...input } : area,
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

  const archiveServiceArea = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.map((area) =>
        area.id === id ? { ...area, archived: true, archivedAt: archiveTimestamp() } : area,
      ),
    }));
  }, []);

  const restoreServiceArea = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.map((area) =>
        area.id === id ? { ...area, archived: false, archivedAt: undefined } : area,
      ),
    }));
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



  
  const updateDeliveryPerson = useCallback((id: string, person: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((o) => (o.id === id ? { ...o, deliveryPerson: person } : o)),
    }));
  }, []);

  const updateDeliveryTeamMemberStatus = useCallback((id: string, status: AvailabilityStatus) => {
    setData((prev) => ({
      ...prev,
      deliveryTeam: prev.deliveryTeam.map((m) => (m.id === id ? { ...m, status } : m)),
    }));
  }, []);

  const reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string, reassignNote?: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((o) => (o.id === orderId ? { ...o, deliveryPerson: newPersonId } : o)),
    }));
  }, []);

  const addStockRequest = useCallback((input: StockRequestInput) => {
    setData((prev) => ({
      ...prev,
      stockRequests: [...(prev.stockRequests || []), { ...input, id: createId("sr"), status: "Pending", createdAt: new Date().toISOString() }]
    }));
  }, []);

  const updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => {
    setData((prev) => ({
      ...prev,
      stockRequests: (prev.stockRequests || []).map(req => req.id === id ? { ...req, status, adminNote: adminNote !== undefined ? adminNote : req.adminNote } : req)
    }));
  }, []);

  const archiveStockItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.map((item) =>
        item.id === id ? { ...item, archived: true, archivedAt: new Date().toISOString() } : item
      ),
    }));
  }, []);

  const archiveStockCategory = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockCategories: prev.stockCategories.map((c) =>
        c.id === id ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c
      ),
    }));
  }, []);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      ...data,
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
      archiveStockItem,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      archiveStockCategory,
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
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      archiveServiceArea,
      restoreServiceArea,
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
      archiveStockItem,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      archiveStockCategory,
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
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      archiveServiceArea,
      restoreServiceArea,
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
