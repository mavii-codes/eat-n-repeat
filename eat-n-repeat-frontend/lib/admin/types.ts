export type NotificationType = "low_stock" | "new_order" | "system" | "order_cancelled" | "payment_verified";

export type AdminNotification = {
  id: string;
  type: NotificationType;
  title: string;
  timestamp: string;
};

export type PaymentVerificationStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export type RecentOrder = {
  id: string;
  orderId: string;
  time: string;
  items: string;
  total: number;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  notes?: string;
  paid?: boolean;
  paymentMethod?: string;
  paymentStatus?: PaymentVerificationStatus;
  xenditReference?: string;
  xenditInvoiceId?: string;
  paidAt?: string;
  archived: boolean;
  archivedAt?: string;
  customerName?: string;
  orderType?: "dine-in" | "takeout" | "delivery";
  tableNumber?: string;
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

export type CustomizationOption = {
  name: string;
  price: number;
};

export type CustomizationConfig = {
  enabled: boolean;
  spiceLevels?: string[]; // e.g., ["None", "Mild", "Medium", "Hot"]
  drinkSizes?: CustomizationOption[]; // e.g., [{name: "Small", price: 0}, {name: "Medium", price: 10}]
  sugarLevels?: string[]; // e.g., ["0%", "25%", "50%", "75%", "100%"]
  iceLevels?: string[]; // e.g., ["No Ice", "Less Ice", "Normal Ice", "Extra Ice"]
  riceOptions?: CustomizationOption[];
  addons?: CustomizationOption[];
  enableSpecialInstructions: boolean;
};

export type CartItemCustomization = {
  spiceLevel?: string;
  drinkSize?: CustomizationOption;
  sugarLevel?: string;
  iceLevel?: string;
  riceOption?: CustomizationOption;
  addons?: CustomizationOption[];
  notes?: string;
};

export type MenuSize = {
  name: string;
  price: number;
  available: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  available: boolean;
  image?: string;
  calories?: string;
  allergens?: string[];
  spiceLevel?: string;
  servingSize?: string;
  stockItemId?: string;
  customizations?: CustomizationConfig;
  sizes?: MenuSize[];
  archived: boolean;
  archivedAt?: string;
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  createdAt: string;
};

export type AddonInput = Omit<Addon, "id" | "createdAt">;

export type StockCategory = {
  archived?: boolean;
  archivedAt?: string;
  id: string;
  name: string;
};

export type StockItem = {
  archived?: boolean;
  archivedAt?: string;
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
};

export type StockRequest = {
  id: string;
  staffId: string;
  staffName: string;
  ingredientId: string;
  ingredientName: string;
  currentQuantity: number;
  unit: string;
  threshold: number;
  status: "Pending" | "Approved" | "Rejected";
  message: string;
  adminNote?: string;
  createdAt: string;
};

export type StockRequestInput = Omit<StockRequest, "id" | "status" | "createdAt">;

export type StockHistoryLog = {
  id: string;
  stockItemId: string;
  itemName: string;
  action: "Added" | "Removed" | "Updated" | "Restocked";
  changeQty: number;
  prevQty: number;
  newQty: number;
  performedBy: string;
  timestamp: string;
  reason?: string;
};

export type StockHistoryInput = Omit<StockHistoryLog, "id" | "timestamp">;

export type StaffRole = "admin" | "staff" | "delivery_rider";

export type StaffAccount = {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: StaffRole;
  status: "active" | "inactive";
  availability: "Online" | "Offline" | "On Duty" | "Off Duty" | "On Leave";
  contactNumber?: string;
  lastActive?: string;
  createdAt?: string;
  archived: boolean;
  archivedAt?: string;
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


export type CashShift = {
  id: string;
  staff_id: string;
  staff_name: string;
  start_time: string;
  end_time?: string;
  starting_float: number | string;
  expected_cash: number | string;
  actual_cash?: number | string;
  difference?: number | string;
  status: 'open' | 'matched' | 'short' | 'over';
};

export type CashTransaction = {
  id: string;
  shift_id: string;
  order_id?: string;
  type: 'sale' | 'refund' | 'float_adjustment';
  amount: number | string;
  timestamp: string;
};

export type AdminDataState = {
  activeCashShift: CashShift | null;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  stockCategories: StockCategory[];
  stockItems: StockItem[];
  staffAccounts: StaffAccount[];
  systemSettings: SystemSettings;
  deliveryOrders: DeliveryOrder[];
  deliveryTeam: DeliveryTeamMember[];
  serviceAreas: ServiceArea[];
  deliverySettings: DeliverySettings;
  storeOrders: RecentOrder[];
  stockRequests: StockRequest[];
  stockHistoryLogs?: StockHistoryLog[];
};

export type MenuItemInput = Omit<MenuItem, "id" | "archived" | "archivedAt">;
export type MenuCategoryInput = Omit<MenuCategory, "id" | "archived" | "archivedAt">;
export type StockItemInput = Omit<StockItem, "id" | "archived" | "archivedAt">;
export type StockCategoryInput = Omit<StockCategory, "id" | "archived" | "archivedAt">;
export type StaffAccountInput = Omit<StaffAccount, "id" | "archived" | "archivedAt">;

export type AvailabilityStatus = "Available" | "Unavailable";

export type DeliveryRoleType = "Delivery Rider" | "Café Owner";

export type DeliveryPersonType = "RIDER" | "OWNER";

export type DeliveryTeamMember = {
  id: string;
  name: string;
  role: DeliveryRoleType;
  personType: DeliveryPersonType;
  status: AvailabilityStatus;
  activeDeliveriesCount?: number;
};

export type AssignmentLogEntry = {
  id: string;
  timestamp: string;
  personName: string;
  personRole: DeliveryRoleType | string;
  action: "Assigned" | "Reassigned" | "Status Updated";
  note?: string;
};

export type DeliveryStatus =
  | "pending"
  | "preparing"
  | "ready_for_delivery"
  | "assigned"
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
  notes?: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  deliveryPersonRole?: DeliveryRoleType;
  deliveryPersonType?: DeliveryPersonType;
  deliveryPerson?: string; // "Delivery Rider" | "Café Owner"
  assignedRole?: string;
  assignedAt?: string;
  assignmentHistory?: AssignmentLogEntry[];
  estimatedDeliveryTime?: string;
  deliveryDistanceKm?: number;
  deliveryFeeRule?: string;
  orderedAt: string;
  pendingAt?: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyForDeliveryAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  cancelledBy?: "CUSTOMER" | "STAFF";
  cancelledAt?: string;
  paid?: boolean;
  paymentMethod?: string;
  paymentStatus?: PaymentVerificationStatus;
  xenditReference?: string;
  xenditInvoiceId?: string;
  paidAt?: string;
  archived: boolean;
  archivedAt?: string;
};

export type ServiceArea = {
  id: string;
  name: string;
  barangay: string;
  municipality: string;
  distanceKm: number;
  active: boolean;
  archived: boolean;
  archivedAt?: string;
};

export type DeliverySettings = {
  cafeLocation: string;
  deliveryEnabled: boolean;
  baseDeliveryFee: number;
  perKmFee: number;
  freeDeliveryRadiusKm: number;
  maxDeliveryRadiusKm: number;
};

export type DeliveryOrderInput = Omit<DeliveryOrder, "id" | "archived" | "archivedAt">;
export type ServiceAreaInput = Omit<ServiceArea, "id" | "archived" | "archivedAt">;
