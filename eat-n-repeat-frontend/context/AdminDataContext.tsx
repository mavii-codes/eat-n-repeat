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
  AttendanceRecord,
  AttendanceStatus,
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
    attendanceRecords: data.attendanceRecords ?? initialAdminData.attendanceRecords ?? [],
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
  addStockCategory: (input: StockCategoryInput) => void;
  updateStockCategory: (id: string, input: StockCategoryInput) => void;
  deleteStockCategory: (id: string) => boolean;
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
  addDeliveryOrder: (input: DeliveryOrderInput) => void;
  deleteDeliveryOrder: (id: string) => void;
  archiveDeliveryOrder: (id: string) => void;
  restoreDeliveryOrder: (id: string) => void;
  archiveStoreOrder: (id: string) => void;
  restoreStoreOrder: (id: string) => void;
  updateStoreOrderStatus: (id: string, status: "pending" | "completed" | "cancelled") => void;
  confirmStoreOrderPayment: (id: string) => void;
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
  clockIn: (staffId: string, staffName: string) => void;
  clockOut: (staffId: string) => void;
  addAttendanceRecord: (input: Omit<AttendanceRecord, "id">) => void;
  updateAttendanceRecord: (id: string, input: Partial<AttendanceRecord>) => void;
  deleteAttendanceRecord: (id: string) => void;
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

  const confirmStoreOrderPayment = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      storeOrders: prev.storeOrders.map((order) =>
        order.id === id ? { ...order, paid: true } : order
      ),
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

  const clockIn = useCallback((staffId: string, staffName: string) => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const parseTimeVal = (timeStr: string) => {
      const [t, modifier] = timeStr.split(" ");
      let [hours, minutes] = t.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    const nowMins = parseTimeVal(nowTime);
    const thresholdMins = 8 * 60 + 30; // 08:30 AM
    const status: AttendanceStatus = nowMins > thresholdMins ? "Late" : "Present";

    setData((prev) => {
      const exists = prev.attendanceRecords.some((r) => r.staffId === staffId && r.date === todayStr);
      if (exists) return prev;

      const newRecord: AttendanceRecord = {
        id: createId("att"),
        staffId,
        staffName,
        date: todayStr,
        timeIn: nowTime,
        status,
      };
      return {
        ...prev,
        attendanceRecords: [...prev.attendanceRecords, newRecord],
      };
    });
  }, []);

  const clockOut = useCallback((staffId: string) => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    setData((prev) => {
      return {
        ...prev,
        attendanceRecords: prev.attendanceRecords.map((r) => {
          if (r.staffId === staffId && r.date === todayStr && !r.timeOut && (r.status === "Present" || r.status === "Late")) {
            let totalHours = undefined;
            try {
              const parseTime = (timeStr: string, dateStr: string) => {
                const [time, modifier] = timeStr.split(" ");
                let [hours, minutes] = time.split(":").map(Number);
                if (modifier === "PM" && hours < 12) hours += 12;
                if (modifier === "AM" && hours === 12) hours = 0;
                return new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
              };
              if (r.timeIn) {
                const inDate = parseTime(r.timeIn, r.date);
                const outDate = parseTime(nowTime, r.date);
                const diffMs = outDate.getTime() - inDate.getTime();
                if (diffMs > 0) {
                  totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
                }
              }
            } catch (e) {
              console.error("Error parsing hours:", e);
            }
            return {
              ...r,
              timeOut: nowTime,
              status: r.status,
              totalHours,
            };
          }
          return r;
        }),
      };
    });
  }, []);

  const addAttendanceRecord = useCallback((input: Omit<AttendanceRecord, "id">) => {
    setData((prev) => ({
      ...prev,
      attendanceRecords: [
        ...prev.attendanceRecords,
        { ...input, id: createId("att") },
      ],
    }));
  }, []);

  const updateAttendanceRecord = useCallback((id: string, input: Partial<AttendanceRecord>) => {
    setData((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.map((r) =>
        r.id === id ? { ...r, ...input, id } : r
      ),
    }));
  }, []);

  const deleteAttendanceRecord = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.filter((r) => r.id !== id),
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
      clockIn,
      clockOut,
      addAttendanceRecord,
      updateAttendanceRecord,
      deleteAttendanceRecord,
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
      clockIn,
      clockOut,
      addAttendanceRecord,
      updateAttendanceRecord,
      deleteAttendanceRecord,
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
