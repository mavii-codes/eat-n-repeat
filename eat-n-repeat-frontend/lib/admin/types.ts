export type NotificationType = "low_stock" | "new_order" | "system";

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
  /* Additive (Phase 3): the ordering customer's account id when the backend
     row carries one — powers the "Flag customer" report entry. Absent on
     walk-ins and device-only offline rows; never relied on elsewhere. */
  customerId?: string;
  customerName?: string;
  orderType?: string;
  orderMode?: string;
  time: string;
  // ISO creation timestamp for reliable newest-first sorting and full
  // date+time display. Optional so previously cached rows keep working
  // (they fall back to parsing `time`, then sort last).
  // NOTE: this is a frontend carry-through of the existing DB `createdAt`,
  // not a new database field.
  orderedAt?: string;
  items: string;
  total: number;
  status: "pending" | "awaiting_payment" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  notes?: string;
  paid?: boolean;
  paymentMethod?: string;
  paymentStatus?: PaymentVerificationStatus;
  // Cash collected while offline: paid locally, queued for the server drain.
  // Server rows never carry this flag, so the next successful repull clears
  // it automatically once the backend confirms the payment.
  paymentSyncPending?: boolean;
  // Optional contact fields (present on server-fetched rows; read
  // optionally by the order details modal).
  phone?: string;
  address?: string;
  serviceAreaId?: string;
  // Pick-Up / Take-Out details (null/absent on delivery, dine-in, and legacy
  // pickup rows; displays fall back to customerName for those).
  pickupName?: string | null;
  pickupAt?: string | null;
  xenditReference?: string;
  xenditInvoiceId?: string;
  paidAt?: string;
  archived: boolean;
  archivedAt?: string;
};

export type SalesDataPoint = {
  label: string;
  amount: number;
};

export type SalesView = "monthly" | "weekly";

// Live bundle from GET /api/sales/figures (normalized to camelCase).
export type SalesFigures = {
  today: {
    revenue: number;
    orders: number;
    completed: number;
    pending: number;
    /* Additive (promo codes): server-computed discounts for today's
       completed sales and the undiscounted gross they came off of.
       Older backends normalize to 0 / revenue respectively. */
    totalDiscounts: number;
    grossBeforeDiscounts: number;
  };
  yesterdayRevenue: number;
  changePct: number | null;
  weekly: SalesDataPoint[];
  weeklyTotal: number;
  monthly: SalesDataPoint[];
  monthlyTotal: number;
  yearlyTotal: number;
  /* Additive (promo codes): discount + pre-discount gross windows,
     matching the today fields above. */
  monthlyTotalDiscounts: number;
  monthlyGrossBeforeDiscounts: number;
  yearlyTotalDiscounts: number;
  yearlyGrossBeforeDiscounts: number;
  generatedAt: string;
};

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

export type MenuItemSize = {
  name: string;
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  available: boolean;
  image?: string;
  stockItemId?: string | null;
  stockMode?: "NONE" | "DIRECT";
  stockQuantity?: number | null;
  stockUnit?: string | null;
  lowStockThreshold?: number | null;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  createStockItem?: {
    unit: string;
    categoryId: string;
    lowStockThreshold?: number;
  };
  // Optional size options with absolute per-size prices. Absent/empty =
  // single base-price item needing no size selection.
  sizes?: MenuItemSize[];
  archived: boolean;
  archivedAt?: string;
};

export type StockCategory = {
  id: string;
  name: string;
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  image?: string | null;
  createdAt: string;
};

export type AddonInput = Omit<Addon, "id" | "createdAt">;

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
  notes?: string | null;
  verification_status?: 'unverified' | 'verified' | 'flagged' | string;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  flag_reason?: string | null;
  cash_sales?: number | null;
  gcash_sales?: number | null;
  /** Net expenses: a Number on the shift LIST (mapShift), or an
   *  ExpenseItem[] array on /shift/current and shift-details payloads. */
  expenses?: number | string | ExpenseItem[];
  expenses_count?: number | string;
};

/** Response from GET /api/expenses/summary. `stockPurchases` covers inventory
 *  stock-ins for the same date range and is intentionally tracked OUTSIDE
 *  `total`/`count` so it never double-counts against the expense ledger. */
export type ExpensesSummary = {
  total: number;
  count: number;
  stockPurchases?: { total: number; count: number };
};

export type ExpenseItem = {
  id: string;
  /** Expense date as sent (YYYY-MM-DD or ISO stamp). */
  expenseDate: string;
  amount: number | string;
  category: string;
  reason: string;
  note?: string | null;
  payee?: string | null;
  /** "drawer" = staff POS paid-out, "admin" = admin log entry. */
  source: "drawer" | "admin" | string;
  paymentSource: "cash_drawer" | "other" | string;
  status: "active" | "voided" | string;
  voidReason?: string | null;
  voidedByName?: string | null;
  voidedAt?: string | null;
  /** Set on the reversal row itself — it points at the original expense. */
  reversalOfId?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  shiftId?: string | null;
  createdAt: string;
  /** Shift-payload rows expose the kind explicitly. */
  kind?: "expense" | "reversal" | string;
};

export type CashTransaction = {
  id: string;
  shift_id: string;
  order_id?: string;
  type: 'sale' | 'refund' | 'float_adjustment' | 'float_addition';
  amount: number | string;
  admin_id?: string;
  admin_name?: string;
  reason?: string;
  timestamp: string;
};

export type StockItem = {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
};

/* ── Inventory dashboard (Phase A) — mirrors the /api/stock/* contract ── */

export type StockMovementType =
  | "STOCK_IN"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_REMOVE"
  | "SALE_DEDUCTION"
  | "SALE_CANCEL_RELEASE"
  | "OPENING_BALANCE";

export type StockMovement = {
  id: string;
  stockItemId: string;
  itemName: string;
  type: StockMovementType | string;
  quantityChange: number | string;
  balanceBefore: number | string;
  balanceAfter: number | string;
  unitCost: number | null;
  totalCost: number | null;
  reason?: string | null;
  reference?: string | null;
  receivedAt?: string | null;
  expiryDate?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type StockDashboardResponse = {
  cards: {
    totalStockValue: number;
    valueIsEstimate: boolean;
    itemsWithoutCost: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    alreadyExpiredCount?: number;
  };
  lists: {
    lowStockItems: {
      id: string;
      name: string;
      quantity: number;
      unit: string;
      lowStockThreshold: number;
    }[];
    outOfStockItems: {
      id: string;
      name: string;
      quantity: number;
      unit: string;
      lowStockThreshold: number;
    }[];
    expiringSoon: {
      id: string;
      stockItemId: string;
      itemName: string;
      quantityRemaining: number;
      unit: string;
      expiryDate: string;
      receivedAt: string;
    }[];
    recentMovements: StockMovement[];
    mostUsedThisWeek: {
      stockItemId: string;
      itemName: string;
      unit: string;
      used: number;
    }[];
  };
};

export type StockMovementPage = {
  movements: StockMovement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type StockAdjustReason =
  | "Spoilage"
  | "Waste"
  | "Breakage"
  | "Expired"
  | "Recount correction"
  | "Found extra"
  | "Other";

export type StockInInput = {
  quantity: number;
  unitCost: number;
  receivedAt?: string | null;
  expiryDate?: string | null;
  supplier?: string | null;
  note?: string | null;
};

export type StockAdjustInput = {
  direction: "add" | "remove";
  quantity: number;
  reason: StockAdjustReason;
  note?: string | null;
  receivedAt?: string | null;
  expiryDate?: string | null;
};

export type StockMutationItemSnapshot = {
  id: string;
  name: string;
  quantity: number;
  unit?: string | null;
};

export type StockMutationResponse = {
  ok: boolean;
  message: string;
  field?: string;
  errors?: Array<{ field: string; message: string }>;
  movement: StockMovement | null;
  item: StockMutationItemSnapshot | null;
};

/** One FIFO cost layer of a stock item (GET /api/stock/items/:id/layers).
 *  Phase B: the server returns full layer metadata and the array is
 *  pre-sorted nearest-expiry-first (null expiry last, then oldest created).
 *  PATCH /api/stock/items/:id/layers/:layerId/cost returns the same shape. */
export type StockLayer = {
  id: string;
  /** Unit cost, or null when not recorded. */
  unitCost: number | null;
  /** True when no unit cost was ever recorded for this layer (the value
   *  cards treat the item as an estimate) — this is the editable case. */
  costNotSet: boolean;
  /** Remaining quantity in this layer. */
  remaining: number;
  /** Quantity originally received into this layer, when known (null for
   *  auto-recovered residual layers). */
  quantityReceived: number | null;
  /** When the goods physically arrived (null → UI falls back to createdAt). */
  receivedAt: string | null;
  /** Expiry date of this layer; null = no expiry tracked. */
  expiryDate: string | null;
  /** True when this layer is the item's opening baseline. */
  isOpening: boolean;
  /** "sm-…" movement id | "opening" | "residual" | null. */
  sourceRef: string | null;
  /** The stock movement that created this layer, when one exists. */
  sourceMovementId: string | null;
  createdAt: string;
};

export type StockRequest = {
  id: string;
  staffId: string;
  staffName: string;
  ingredientId: string;
  ingredientName: string;
  currentQuantity: number;
  unit?: string;
  threshold: number;
  message: string;
  status: "Pending" | "Approved" | "Rejected";
  adminNote?: string;
  createdAt: string;
};

export type StockRequestInput = Omit<StockRequest, "id" | "status" | "adminNote" | "createdAt">;

export type StaffRole = "admin" | "head_staff" | "staff" | "delivery_rider";

export type StaffAccount = {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: StaffRole;
  status: "active" | "inactive";
  availability?: "Online" | "Offline" | "On Duty" | "Off Duty" | "On Leave";
  lastActive?: string;
  createdAt?: string;
  archived: boolean;
  archivedAt?: string;
  // Backend contract: set on login when the account still carries the
  // administrator-generated initial password. Optional so every existing
  // local/offline account is unaffected.
  mustChangePassword?: boolean;
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
  stockRequests: StockRequest[];
  staffAccounts: StaffAccount[];
  systemSettings: SystemSettings;
  deliveryOrders: DeliveryOrder[];
  serviceAreas: ServiceArea[];
  deliverySettings: DeliverySettings;
  storeOrders: RecentOrder[];
  activeCashShift: CashShift | null;

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
  | "completed"
  | "cancelled";

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  /* Additive (Phase 3): ordering customer's account id (see RecentOrder). */
  customerId?: string;
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
  notes?: string;
  archived: boolean;
  archivedAt?: string;
};

export type ServiceArea = {
  id: string;
  name: string;
  barangay: string;
  deliveryFee: number;
  distanceKm?: number;
  active: boolean;
  archived?: boolean;
  archivedAt?: string;
};

export type DeliverySettings = {
  baseDeliveryFee: number;
  freeDeliveryMinimum: number;
  maxDeliveryRadiusKm: number;
  freeDeliveryRadiusKm?: number;
  perKmFee?: number;
};

export type DeliveryOrderInput = Omit<DeliveryOrder, "id" | "archived" | "archivedAt">;
export type ServiceAreaInput = Omit<ServiceArea, "id">;
