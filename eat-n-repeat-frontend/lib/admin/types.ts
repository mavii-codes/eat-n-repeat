export type NotificationType = "low_stock" | "new_order" | "system";

export type AdminNotification = {
  id: string;
  type: NotificationType;
  title: string;
  timestamp: string;
};

export type RecentOrder = {
  id: string;
  orderId: string;
  time: string;
  items: string;
  total: number;
  status: "pending" | "completed" | "cancelled";
  paid?: boolean;
  archived: boolean;
  archivedAt?: string;
};

export type SalesDataPoint = {
  label: string;
  amount: number;
};

export type SalesView = "monthly" | "weekly";

export type DashboardStats = {
  todaysRevenue: number;
  revenueChange: number;
  ordersToday: number;
  ordersChange: number;
  completedOrders: number;
  pendingOrders: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  archivedAt?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  available: boolean;
  archived: boolean;
  archivedAt?: string;
};

export type StockCategory = {
  id: string;
  name: string;
};

export type StockItem = {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
};

export type StaffRole = "admin" | "head_staff" | "staff";

export type StaffAccount = {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: StaffRole;
  status: "active" | "inactive";
  archived: boolean;
  archivedAt?: string;
};

export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

export type AttendanceRecord = {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  timeIn?: string; // e.g. "08:30 AM"
  timeOut?: string; // e.g. "05:30 PM"
  status: AttendanceStatus;
  totalHours?: number;
  reason?: string; // Reason for excused absences
};

export type SystemSettings = {
  cafeName: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  currency: string;
  taxRate: number;
  lowStockAlerts: boolean;
  orderNotifications: boolean;
};

export type AdminDataState = {
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  stockCategories: StockCategory[];
  stockItems: StockItem[];
  staffAccounts: StaffAccount[];
  systemSettings: SystemSettings;
  deliveryOrders: DeliveryOrder[];
  serviceAreas: ServiceArea[];
  deliverySettings: DeliverySettings;
  storeOrders: RecentOrder[];
  attendanceRecords: AttendanceRecord[];
};

export type MenuItemInput = Omit<MenuItem, "id" | "archived" | "archivedAt">;
export type MenuCategoryInput = Omit<MenuCategory, "id" | "archived" | "archivedAt">;
export type StockItemInput = Omit<StockItem, "id">;
export type StockCategoryInput = Omit<StockCategory, "id">;
export type StaffAccountInput = Omit<StaffAccount, "id" | "archived" | "archivedAt">;

export type DeliveryStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  serviceAreaId: string;
  items: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: DeliveryStatus;
  orderedAt: string;
  deliveredAt?: string;
  archived: boolean;
  archivedAt?: string;
};

export type ServiceArea = {
  id: string;
  name: string;
  barangay: string;
  deliveryFee: number;
  active: boolean;
};

export type DeliverySettings = {
  baseDeliveryFee: number;
  freeDeliveryMinimum: number;
  maxDeliveryRadiusKm: number;
};

export type DeliveryOrderInput = Omit<DeliveryOrder, "id" | "archived" | "archivedAt">;
export type ServiceAreaInput = Omit<ServiceArea, "id">;
