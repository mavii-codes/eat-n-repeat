"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { Bell, Search, Eye, X, Filter, MapPin, MessageCircle, Archive, Edit3, Plus, ArrowDownAZ, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { StaffInventoryTab } from "@/components/staff/StaffInventoryTab";
import { DeliveryOrdersTable } from "@/components/admin/DeliveryOrdersTable";
import { POSCashierTab } from "@/components/staff/POSCashierTab";
import { ArchiveTab } from "@/components/admin/ArchiveTab";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
  CrudActions,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminChatModal } from "@/components/admin/AdminChatModal";
import { PaymentDetailsModal } from "@/components/admin/PaymentDetailsModal";
import { StartShiftModal, EndShiftModal, CashPaymentModal } from "@/components/staff/CashModals";
import { StatCard, DollarIcon, ClipboardIcon, TrendIcon } from "@/components/admin/StatCard";
import { StaffNotificationPanel } from "@/components/staff/StaffNotificationPanel";
import type { MenuItem, MenuItemInput, StaffRole, DeliveryStatus } from "@/lib/admin/types";

type StaffTab = "dashboard" | "orders" | "menu" | "inventory" | "delivery" | "archive" | "profile" | "pos";

type POSCartItem = { item: MenuItem; qty: number };

const PHP_DENOMINATIONS = [
  { value: 1000, label: "₱1,000 bill" },
  { value: 500, label: "₱500 bill" },
  { value: 200, label: "₱200 bill" },
  { value: 100, label: "₱100 bill" },
  { value: 50, label: "₱50 bill" },
  { value: 20, label: "₱20 bill" },
  { value: 10, label: "₱10 coin" },
  { value: 5, label: "₱5 coin" },
  { value: 1, label: "₱1 coin" },
  { value: 0.25, label: "₱0.25 coin" },
];

function breakdownChange(change: number): { label: string; count: number }[] {
  let remaining = Math.round(change * 100) / 100;
  const result: { label: string; count: number }[] = [];
  for (const denom of PHP_DENOMINATIONS) {
    if (remaining >= denom.value) {
      const count = Math.floor(remaining / denom.value);
      remaining = Math.round((remaining - count * denom.value) * 100) / 100;
      result.push({ label: denom.label, count });
    }
  }
  return result;
}

function getWeekRange(dateStr: string): { start: string; end: string; label: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  return {
    start: startStr,
    end: endStr,
    label: `${startStr} to ${endStr}`,
  };
}

function getMonthLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function StaffPortalPage() {
  const { user, logout, changePassword, updateProfile } = useAuth();
  const {
    storeOrders,
    deliveryOrders,
    menuItems,
    menuCategories,
    stockItems,
    stockCategories,
    updateStoreOrderStatus,
    confirmStoreOrderPayment,
    addStoreOrder,
    addMenuItem,
    updateMenuItem,
    updateDeliveryStatus,
    updateDeliveryPerson,
    getServiceAreaName,
    getMenuCategoryName,
    getStockCategoryName,
    staffAccounts,
    archiveMenuItem,
    addStockItem,
    updateStockItem,
    deleteStockItem,
  } = useAdminData();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");

  // Menu Tab State
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCatFilter, setMenuCatFilter] = useState("all");
  const [menuAvailFilter, setMenuAvailFilter] = useState("all");
  const [menuSort, setMenuSort] = useState("name-asc");
  const [itemToArchive, setItemToArchive] = useState<any | null>(null);

  // Orders Tab State
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("delivery");
  const [orderHistorySearch, setOrderHistorySearch] = useState("");
  const [orderHistoryStatusFilter, setOrderHistoryStatusFilter] = useState("all");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any | null>(null);

  // Cash Register States
  const { activeCashShift, fetchActiveCashShift } = useAdminData();
  const [startShiftOpen, setStartShiftOpen] = useState(false);
  const [endShiftOpen, setEndShiftOpen] = useState(false);
  const [cashPaymentOrder, setCashPaymentOrder] = useState<any | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Form states for adding/editing menu items
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState<MenuItemInput>({
    name: "",
    description: "",
    price: 0,
    categoryId: menuCategories[0]?.id || "",
    available: true,
    image: "",
  });

  // Profile Form States
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form States
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmNewPwd, setConfirmNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);


  // POS Cashier States
  const [posCart, setPosCart] = useState<POSCartItem[]>([]);
  const [posTendered, setPosTendered] = useState("");
  const [posReceiptOpen, setPosReceiptOpen] = useState(false);
  const [posSearchTerm, setPosSearchTerm] = useState("");
  const [posCategoryFilter, setPosCategoryFilter] = useState("all");
  const [posReceiptData, setPosReceiptData] = useState<{
    cart: POSCartItem[];
    subtotal: number;
    tax: number;
    total: number;
    tendered: number;
    change: number;
    breakdown: { label: string; count: number }[];
    receiptNo: string;
    date: string;
    time: string;
    cashier: string;
  } | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<{ customerName: string; orderNumber: string } | null>(null);

  const handleOpenChat = (customerName: string, orderNumber: string) => {
    setActiveChatOrder({ customerName, orderNumber });
    setChatOpen(true);
  };
  
  const handleNavigateToOrder = (type: string, orderId: string) => {
    if (type === "delivery" || type === "status") {
      setActiveTab("delivery");
    } else {
      setActiveTab("orders");
      setOrderHistorySearch(orderId);
      setOrderSearch(orderId);
    }
  };

  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    fetchActiveCashShift();
    setCurrentTime(
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);



  // Load profile values on mount/user load
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      setProfileUsername(user.username);
    }
  }, [user]);

  // Tab configurations
  const tabs = useMemo(() => {
    const list: { id: StaffTab; label: string; icon: React.ReactNode }[] = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        id: "orders",
        label: "Customer Orders",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        id: "menu",
        label: "Menu Items",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        ),
      },
      {
        id: "inventory",
        label: "Inventory / Stock",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      
      {
        id: "archive",
        label: "Archived Items",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        ),
      },
    ];

    list.push({
      id: "pos" as StaffTab,
      label: "POS Cashier",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h2M10 15h2M14 15h2" />
          <path d="M12 4V2" />
        </svg>
      ),
    });

    list.push({
      id: "profile",
      label: "My Profile",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    });

    return list;
  }, [user]);

  // Dynamic Sales Calculations for Daily Summary
  const salesSummary = useMemo(() => {
    const activeStore = storeOrders.filter(o => !o.archived);
    const activeDel = deliveryOrders.filter(o => !o.archived);

    const storePaidSales = activeStore.filter(o => o.status === "completed" || o.paid).reduce((sum, o) => sum + o.total, 0);
    const delDeliveredSales = activeDel.filter(o => o.status === "delivered").reduce((sum, o) => sum + o.total, 0);
    const totalSales = storePaidSales + delDeliveredSales;

    const totalOrders = activeStore.length + activeDel.length;
    const completedOrders = activeStore.filter(o => o.status === "completed").length + activeDel.filter(o => o.status === "delivered").length;
    const pendingOrders = activeStore.filter(o => o.status === "pending").length + activeDel.filter(o => ["pending", "confirmed", "preparing", "out_for_delivery"].includes(o.status)).length;

    return {
      totalSales,
      totalOrders,
      completedOrders,
      pendingOrders,
    };
  }, [storeOrders, deliveryOrders]);

  // Live low-stock notifications calculated dynamically
  const stockNotifications = useMemo(() => {
    return stockItems
      .filter((item) => item.quantity <= item.lowStockThreshold)
      .map((item) => ({
        id: `low-${item.id}`,
        title: `Low stock: ${item.name}`,
        details: `Only ${item.quantity} ${item.unit} remaining (Threshold: ${item.lowStockThreshold})`,
        timestamp: "Just Now",
      }));
  }, [stockItems]);

  // Toggle availability of menu items
  function handleToggleAvailability(item: MenuItem) {
    updateMenuItem(item.id, {
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: !item.available,
    });
  }

  // Handle open add menu item
  function openAddMenu() {
    setEditingMenuItem(null);
    setMenuForm({
      name: "",
      description: "",
      price: 0,
      categoryId: menuCategories[0]?.id || "",
      available: true,
      image: "",
    });
    setMenuModalOpen(true);
  }

  // Handle open edit menu item
  function openEditMenu(item: MenuItem) {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
      image: item.image || "",
    });
    setMenuModalOpen(true);
  }

  // Submit Menu Item Form
  function handleMenuSubmit() {
    if (!menuForm.name.trim() || menuForm.price <= 0) return;

    if (editingMenuItem) {
      updateMenuItem(editingMenuItem.id, menuForm);
    } else {
      addMenuItem(menuForm);
    }
    setMenuModalOpen(false);
  }

  // Profile Edit Submission
  const handleStartShift = async (float: number) => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      await fetch(`${getApiUrl()}/api/cash/shift/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startingFloat: float })
      });
      await fetchActiveCashShift();
      setStartShiftOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleEndShift = async (cash: number) => {
    try {
      if (!activeCashShift) return;
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      await fetch(`${getApiUrl()}/api/cash/shift/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shiftId: activeCashShift.id, actualCash: cash })
      });
      await fetchActiveCashShift();
      setEndShiftOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleConfirmCashPayment = async (cashReceived: number) => {
    if (!cashPaymentOrder) return { success: false, message: "No order selected" };
    return await confirmStoreOrderPayment(cashPaymentOrder.id, cashReceived);
  };

  function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim() || !profileEmail.trim() || !profileUsername.trim()) {
      setProfileError("All profile fields are required.");
      return;
    }

    updateProfile(profileName.trim(), profileEmail.trim(), profileUsername.trim());
    setProfileSuccess("Profile updated successfully.");
  }

  // Password Change Submission
  function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!user) return;

    if (currentPwd !== user.password) {
      setPwdError("Current password is incorrect.");
      return;
    }

    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }

    if (newPwd !== confirmNewPwd) {
      setPwdError("New passwords do not match.");
      return;
    }

    changePassword(newPwd);
    setPwdSuccess("Password updated successfully.");
    setCurrentPwd("");
    setNewPwd("");
    setConfirmNewPwd("");
  }

  // POS Cashier Functions
  const posSubtotal = posCart.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0);
  const posTaxRate = 0; // No tax for simplicity, set to e.g. 0.12 for 12% VAT
  const posTax = Math.round(posSubtotal * posTaxRate * 100) / 100;
  const posTotal = posSubtotal + posTax;
  const posTenderedNum = parseFloat(posTendered) || 0;
  const posChange = posTenderedNum - posTotal;

  function posAddToCart(item: MenuItem) {
    setPosCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) return prev.map((ci) => ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci);
      return [...prev, { item, qty: 1 }];
    });
  }

  function posRemoveFromCart(itemId: string) {
    setPosCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }

  function posUpdateQty(itemId: string, qty: number) {
    if (qty <= 0) { posRemoveFromCart(itemId); return; }
    setPosCart((prev) => prev.map((ci) => ci.item.id === itemId ? { ...ci, qty } : ci));
  }

  function posClearCart() {
    setPosCart([]);
    setPosTendered("");
  }

  function posCompleteTransaction() {
    if (posCart.length === 0 || posTenderedNum < posTotal) return;
    const now = new Date();
    const receiptNo = `ENR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    
    // Save to global context storeOrders list
    addStoreOrder({
      orderId: receiptNo.slice(-8), // use short ID for dashboard visibility
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      items: posCart.map((ci) => `${ci.item.name} (${ci.qty}x)`).join(", "),
      total: posTotal,
      status: "completed",
      paid: true,
    });

    setPosReceiptData({
      cart: [...posCart],
      subtotal: posSubtotal,
      tax: posTax,
      total: posTotal,
      tendered: posTenderedNum,
      change: posChange,
      breakdown: breakdownChange(posChange),
      receiptNo,
      date: now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      cashier: user?.name || "Cashier",
    });
    setPosReceiptOpen(true);
  }

  function posNewTransaction() {
    setPosCart([]);
    setPosTendered("");
    setPosReceiptOpen(false);
    setPosReceiptData(null);
  }

  const posFilteredItems = menuItems.filter((item) => {
    if (item.archived || !item.available) return false;
    if (posCategoryFilter !== "all" && item.categoryId !== posCategoryFilter) return false;
    if (posSearchTerm && !item.name.toLowerCase().includes(posSearchTerm.toLowerCase())) return false;
    return true;
  });

  if (!user) return null;

  return (
    <div className="admin-shell min-h-screen flex flex-col md:flex-row text-[#1c1c1c] w-full max-w-full overflow-x-hidden">
      {/* MOBILE COMPACT HEADER BAR */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-[#500f17] text-white px-4 py-3 shadow-md border-b border-white/10 w-full">
        <div className="flex items-center gap-3">
          <Logo size="sm" showText={false} />
          <div>
            <h1 className="font-serif text-base font-bold text-white leading-tight">Eat n&apos; Repeat</h1>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">
              {tabs.find((t) => t.id === activeTab)?.label || "Staff Portal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <StaffNotificationPanel onNavigateToOrder={handleNavigateToOrder} />

          {/* Hamburger Menu Icon */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-accent/30 text-white hover:bg-accent/50 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* MOBILE SIDEBAR DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="admin-sidebar relative z-50 flex w-72 flex-col h-full bg-[#500f17] text-white shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <Logo size="md" showText={false} />
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
                  Staff Portal
                </p>
                <p className="font-script text-lg text-white/90">Eat n&apos; Repeat</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 px-4 py-5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-accent/30 text-white border-l-4 border-accent shadow-inner"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      activeTab === tab.id ? "bg-accent text-white" : "bg-white/10 text-white/80"
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="text-sm font-semibold">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Footer User Card */}
            <div className="border-t border-white/10 px-5 py-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold text-white">{user?.name}</p>
                  <p className="text-[10px] text-white/50 font-mono">@{user?.username} • {user?.role}</p>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/30 border border-accent/40 py-2 text-xs font-semibold text-white transition-all hover:bg-accent/50 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP LEFT SIDEBAR */}
      <aside className="admin-sidebar hidden md:flex fixed inset-y-0 left-0 z-40 w-72 flex-col overflow-y-auto text-white">
        <div className="border-b border-white/8 px-6 py-6">
          <Logo size="md" showText={false} />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
            Staff Portal
          </p>
          <p className="mt-1 font-script text-xl text-white/90">Eat n&apos; Repeat</p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                activeTab === tab.id
                  ? "bg-accent/20 text-white border-l-4 border-accent shadow-inner"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                activeTab === tab.id ? "bg-accent text-white" : "bg-white/8 text-white/80"
              }`}>
                {tab.icon}
              </span>
              <span className="text-sm font-semibold">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* FOOTER USER CARD */}
        <div className="border-t border-white/8 px-6 py-5 space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold text-white/95">{user.name}</p>
              <p className="text-[10px] text-white/45 font-mono">@{user.username} • {user.role}</p>
            </div>
            <button
              onClick={logout}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/20 border border-accent/30 py-2 text-xs font-semibold text-white transition-all hover:bg-accent/40 active:scale-[0.98] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 pl-0 md:pl-72 flex-1 mx-auto w-full max-w-6xl px-3 sm:px-6 md:px-8 py-4 md:py-8 overflow-x-hidden min-w-0">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 w-full max-w-full min-w-0">
            {/* HEADER */}
            <header className="flex flex-col gap-4 rounded-2xl md:rounded-3xl border border-white/80 bg-white/90 p-4 sm:p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent/80">Staff Workspace</p>
                <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#63131d]">Good day, {user?.name || 'Staff'}!</h1>
                <p className="mt-1 text-xs sm:text-sm text-[#8a5a5a]">Here's your cafe pulse for today.</p>
                <p className="mt-2 text-xs font-medium text-[#63131d]/60 bg-[#63131d]/5 inline-block px-3 py-1 rounded-full border border-[#63131d]/10">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <StaffNotificationPanel onNavigateToOrder={handleNavigateToOrder} />
              </div>
            </header>

            {/* KPI CARDS */}
            <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {[
                { label: "Today's Orders", value: salesSummary.totalOrders, color: "text-[#8b3b25]" },
                { label: "Pending Orders", value: salesSummary.pendingOrders, color: "text-[#9a6100]" },
                { label: "Sales", value: `₱${salesSummary.totalSales.toLocaleString()}`, color: "text-[#24753c]" },
                { label: "Completed", value: salesSummary.completedOrders, color: "text-[#24753c]" },
                { label: "Low Stock", value: stockNotifications.length, color: "text-[#bd2525]" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur-sm transition-all hover:shadow-md hover:bg-white/95">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted uppercase tracking-wide">{stat.label}</p>
                  <p className={`mt-1 font-serif text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </section>

            {/* STATUS SUMMARY */}
            <section className="rounded-2xl border border-white/60 bg-white/80 p-4 sm:p-5 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-bold text-[#63131d] mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                Order Status Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 text-center">
                {[
                  { s: "Pending", c: "bg-amber-50 text-amber-700 border-amber-200" },
                  { s: "Confirmed", c: "bg-blue-50 text-blue-700 border-blue-200" },
                  { s: "Preparing", c: "bg-purple-50 text-purple-700 border-purple-200" },
                  { s: "Ready", c: "bg-teal-50 text-teal-700 border-teal-200" },
                  { s: "Completed", c: "bg-green-50 text-green-700 border-green-200" },
                  { s: "Cancelled", c: "bg-stone-50 text-stone-600 border-stone-200" },
                ].map(status => {
                  const count = [...storeOrders, ...deliveryOrders].filter(o => !o.archived && o.status === status.s.toLowerCase()).length;
                  return (
                    <div key={status.s} className={`rounded-xl border p-2.5 sm:p-3 flex flex-col items-center justify-center ${status.c}`}>
                      <span className="text-xl sm:text-2xl font-bold">{count}</span>
                      <span className="text-[10px] font-semibold uppercase mt-0.5 opacity-80">{status.s}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-6 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
              {/* LEFT COLUMN: CUSTOMER ORDERS */}
              <div className="space-y-6">
                <AdminPanel title="Customer Orders" subtitle="Today's active orders from all channels" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-accent hover:underline">View all</button>}>
                  <div className="overflow-x-auto p-1">
                    <table className="w-full text-left text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-accent/10 text-muted">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Items</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...storeOrders.map(o => ({...o, orderCode: o.orderId, type: "Dine-in/Pickup"})), ...deliveryOrders.map(o => ({...o, orderCode: o.orderNumber, type: "Delivery"}))]
                          .filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered")
                          .sort((a, b) => b.id.localeCompare(a.id))
                          .slice(0, 5)
                          .map((order) => (
                          <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50">
                            <td className="px-4 py-3 font-bold text-[#63131d]">{order.orderCode}</td>
                            <td className="px-4 py-3 text-xs font-medium text-muted">{order.type}</td>
                            <td className="px-4 py-3 text-xs text-[#1c1c1c] truncate max-w-[150px]">{order.items}</td>
                            <td className="px-4 py-3 font-semibold text-[#24753c]">₱{order.total}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                                order.status === "pending" ? "bg-amber-100 text-amber-800" :
                                order.status === "preparing" ? "bg-purple-100 text-purple-800" :
                                "bg-blue-100 text-blue-800"
                              }`}>{order.status}</span>
                            </td>
                          </tr>
                        ))}
                        {[...storeOrders, ...deliveryOrders].filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered").length === 0 && (
                          <tr><td colSpan={5} className="py-8 text-center text-sm text-muted">No active orders at the moment.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
              </AdminPanel>

                <AdminPanel title="Customer Activity" subtitle="Recent interactions & updates">
                  <div className="divide-y divide-accent/5 px-5 py-2">
                    {[...storeOrders.map(o => ({id: o.id, text: `New in-store order #${o.orderId} received`, time: o.time, raw: o})), 
                      ...deliveryOrders.map(o => ({id: o.id, text: `New delivery order #${o.orderNumber} received`, time: o.orderedAt, raw: o}))]
                      .sort((a, b) => b.id.localeCompare(a.id))
                      .slice(0, 4)
                      .map((activity, i) => (
                      <div key={`act-${activity.id}-${i}`} className="flex items-start gap-3 py-3 text-sm">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#63131d]/10 text-[#63131d]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </span>
                        <div className="flex-1">
                          <p className="text-[#1c1c1c] font-medium">{activity.text}</p>
                          <p className="text-[10px] text-muted mt-0.5">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                    {storeOrders.length === 0 && deliveryOrders.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted">No recent activity to show.</p>
                    )}
                  </div>
                </AdminPanel>
              </div>

              {/* RIGHT COLUMN: ALERTS & ACTIONS */}
              <div className="space-y-6">
                <AdminPanel title="Needs Attention" subtitle="Tasks requiring staff action">
                  <div className="divide-y divide-accent/10 px-5">
                    {salesSummary.pendingOrders > 0 && (
                      <button onClick={() => setActiveTab("orders")} className="w-full flex items-center justify-between py-3.5 hover:bg-white/40 transition-colors text-left group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-sm">◷</span>
                          <div>
                            <p className="text-sm font-bold text-[#63131d] group-hover:text-accent">{salesSummary.pendingOrders} Pending Orders</p>
                            <p className="text-[10px] text-muted">Awaiting confirmation or prep</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    )}
                    {stockNotifications.length > 0 && (
                      <button onClick={() => setActiveTab("inventory")} className="w-full flex items-center justify-between py-3.5 hover:bg-white/40 transition-colors text-left group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 font-bold text-sm">!</span>
                          <div>
                            <p className="text-sm font-bold text-[#63131d] group-hover:text-accent">{stockNotifications.length} Low Stock Items</p>
                            <p className="text-[10px] text-muted">Requires replenishment</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    )}
                    {salesSummary.pendingOrders === 0 && stockNotifications.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted">No urgent tasks at the moment.</p>
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel title="Inventory Alerts" subtitle="Low or out of stock items" action={<button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-accent hover:underline">Open stock</button>}>
                  <div className="divide-y divide-accent/10 px-5">
                    {stockNotifications.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex gap-3 py-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-600">!</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#63131d]">{alert.title.replace("Low stock: ", "")}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{alert.details}</p>
                        </div>
                      </div>
                    ))}
                    {stockNotifications.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted">Stock levels are healthy.</p>
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel title="Quick Actions" subtitle="Jump to section">
                  <div className="grid grid-cols-2 gap-3 px-4 py-4 text-center text-[11px] font-semibold text-[#63131d]">
                    {[
                      { label: "View Orders", icon: "▣", action: () => setActiveTab("orders") },
                      { label: "Manage Menu", icon: "☷", action: () => setActiveTab("menu") },
                      { label: "Check Stock", icon: "□", action: () => setActiveTab("inventory") },
                      { label: "Open POS", icon: "₱", action: () => setActiveTab("pos") }
                    ].map((action, index) => (
                      <button key={action.label} onClick={action.action} className="group flex flex-col items-center gap-2 rounded-xl py-3 border border-white/50 bg-white/40 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${["bg-rose-50 text-accent", "bg-emerald-50 text-emerald-700", "bg-blue-50 text-blue-700", "bg-amber-50 text-amber-700"][index]}`}>{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </AdminPanel>
              </div>
            </div>
          </div>
        )}
        {/* TAB 2: CUSTOMER ORDERS */}
        {activeTab === "orders" && (() => {
          // Process data
          const allOrders = [...storeOrders, ...deliveryOrders.map(d => ({
              ...d,
              id: d.id,
              orderId: d.orderNumber,
              time: d.orderedAt,
              orderType: "delivery",
              paid: d.paymentStatus === "paid" || d.paid === true,
              customerName: d.customerName,
              subtotal: d.subtotal,
              deliveryFee: d.deliveryFee,
              paymentStatus: d.paymentStatus || (d.paid ? "paid" : "pending"),
              paymentMethod: d.paymentMethod,
              cancelledBy: d.cancelledBy,
              cancelledAt: d.cancelledAt,
          }))];

          const activeOrders = allOrders.filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled");
          const historyOrders = allOrders.filter(o => o.status === "completed" || o.status === "cancelled");

          // Summary Counts
          const summary = {
            total: activeOrders.length,
            pending: activeOrders.filter(o => o.status === "pending").length,
            preparing: activeOrders.filter(o => o.status === "preparing").length,
            ready: activeOrders.filter(o => o.status === "ready" || o.status === "ready_for_delivery").length,
            completed: historyOrders.filter(o => o.status === "completed").length,
            cancelled: historyOrders.filter(o => o.status === "cancelled").length,
          };

          // Filter active
          const filteredActive = activeOrders.filter(o => {
            const matchesSearch = o.orderId?.toLowerCase().includes(orderSearch.toLowerCase()) || 
                                  o.customerName?.toLowerCase().includes(orderSearch.toLowerCase());
            const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
            const matchesType = orderTypeFilter === "all" || (o.orderType || "dine-in") === orderTypeFilter;
            return matchesSearch && matchesStatus && matchesType;
          }).sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

          // Filter history
          const filteredHistory = historyOrders.filter(o => {
            const matchesSearch = o.orderId?.toLowerCase().includes(orderHistorySearch.toLowerCase()) || 
                                  o.customerName?.toLowerCase().includes(orderHistorySearch.toLowerCase());
            const matchesStatus = orderHistoryStatusFilter === "all" || o.status === orderHistoryStatusFilter;
            return matchesSearch && matchesStatus;
          }).sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

          return (
            <div className="space-y-6">
              {/* HEADER */}
              <div>
                <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#63131d] border border-[#63131d]/10">Operations</span>
                <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5 flex justify-between items-center">
                  Orders Dashboard
                  {!activeCashShift ? (
                    <button onClick={() => setStartShiftOpen(true)} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 shadow-md">
                      Start Cash Shift
                    </button>
                  ) : (
                    <div className="flex gap-3 items-center">
                      <span className="text-sm font-medium text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">Float: ₱{Number(activeCashShift.starting_float).toFixed(2)}</span>
                      <button onClick={() => setEndShiftOpen(true)} className="px-4 py-2 bg-stone-800 text-white text-sm rounded-xl hover:bg-black shadow-md">
                        End Cash Shift
                      </button>
                    </div>
                  )}
                </h1>
                <p className="text-sm text-muted">Manage customer orders, update workflow status, and confirm payments.</p>
              </div>

              {/* SUMMARY ROW */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: "Total Active", value: summary.total, color: "text-[#800000]" },
                  { label: "Pending", value: summary.pending, color: "text-amber-600" },
                  { label: "Preparing", value: summary.preparing, color: "text-blue-600" },
                  { label: "Ready", value: summary.ready, color: "text-indigo-600" },
                  { label: "Completed", value: summary.completed, color: "text-green-700" },
                  { label: "Cancelled", value: summary.cancelled, color: "text-red-600" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/80 backdrop-blur-md rounded-xl p-3 border border-white/40 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-xl font-bold font-serif mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* ACTIVE ORDERS PANEL */}
              <AdminPanel title="Active Orders Tickets" subtitle="Currently processing">
                {/* FILTERS */}
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search ID or customer..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium"
                      value={orderTypeFilter}
                      onChange={(e) => setOrderTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      <option value="dine-in">Dine-in</option>
                      <option value="takeout">Takeout</option>
                      <option value="delivery">Delivery</option>
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                    </select>
                  </div>
                </div>

                
                {/* DESKTOP TABLE / MOBILE CARDS */}
                {orderTypeFilter === 'delivery' ? (
                  <div className="p-0">
                    <DeliveryOrdersTable
                      orders={deliveryOrders}
                      getServiceAreaName={getServiceAreaName}
                      showStatusControl={true}
                      onStatusChange={updateDeliveryStatus}
                      onDeliveryPersonChange={updateDeliveryPerson}
                      onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}
                      isAdmin={user?.role === "admin"}
                    />
                  </div>
                ) : (

                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl">
                  {filteredActive.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/5 flex items-center justify-center mb-3">
                        <Filter className="h-6 w-6 text-accent/40" />
                      </div>
                      <p className="text-[#800000] font-bold">No Active Orders</p>
                      <p className="text-sm text-muted mt-1 max-w-xs">New customer orders will appear here when they are placed.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block w-full min-w-0 overflow-x-hidden">
                        <table className="w-full table-fixed text-left text-xs align-middle">
                          <colgroup>
                            <col className="w-[85px]" />
                            <col className="w-[115px]" />
                            <col className="w-[80px]" />
                            <col className="w-auto" />
                            <col className="w-[80px]" />
                            <col className="w-[130px]" />
                            <col className="w-[120px]" />
                            <col className="w-[90px]" />
                          </colgroup>
                          <thead>
                            <tr className="text-muted border-b border-accent/10 bg-[#63131d]/5 font-semibold text-[11px] uppercase tracking-wider">
                              <th className="px-3 py-3">Order ID</th>
                              <th className="px-3 py-3">Customer</th>
                              <th className="px-3 py-3 text-center">Type</th>
                              <th className="px-3 py-3">Items</th>
                              <th className="px-3 py-3">Total</th>
                              <th className="px-3 py-3">Payment</th>
                              <th className="px-3 py-3">Status</th>
                              <th className="px-3 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/5">
                            {filteredActive.map((order) => (
                              <tr key={order.id} className="hover:bg-accent-light/10 transition-colors h-14">
                                <td className="px-3 py-2.5 font-bold text-[#63131d] truncate align-middle">
                                  {order.orderId}
                                </td>

                                <td className="px-3 py-2.5 font-medium text-stone-800 align-middle">
                                  <span className="line-clamp-2 leading-tight">{order.customerName || "Walk-in"}</span>
                                </td>

                                <td className="px-3 py-2.5 text-center align-middle">
                                  <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600 border border-stone-200 shadow-2xs">
                                    {order.orderType || "dine-in"}
                                  </span>
                                </td>

                                <td className="px-3 py-2.5 text-xs text-stone-600 align-middle">
                          <p className="truncate max-w-full" title={order.items}>{order.items}</p>
                                </td>

                                <td className="px-3 py-2.5 font-bold text-[#63131d] whitespace-nowrap align-middle">
                                  ₱{order.total?.toFixed(2) || ((order as any).subtotal + ((order as any).deliveryFee||0)).toFixed(2)}
                                </td>

                                <td className="px-3 py-2.5 align-middle">
                                  <div className="flex flex-col items-start gap-1">
                                    {(order.paid || order.paymentStatus === "paid" || order.status === "completed" || order.status === "delivered") ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 shadow-2xs whitespace-nowrap">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Paid / Verified
                                      </span>
                                    ) : order.paymentStatus === "failed" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200 shadow-2xs whitespace-nowrap">
                                        🔴 Payment Failed
                                      </span>
                                    ) : order.paymentStatus === "cancelled" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-700 border border-stone-200 shadow-2xs whitespace-nowrap">
                                        ⚪ Cancelled
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200 shadow-2xs whitespace-nowrap">
                                        🔴 Unpaid
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setPaymentModalOrder(order)}
                                      className="text-[10px] font-bold text-[#63131d] hover:underline cursor-pointer leading-none"
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 align-middle">
                                  <AdminSelect
                                    value={order.status}
                                    onChange={(e) => {
                                      if (order.orderType === 'delivery') {
                                        updateDeliveryStatus(order.id, e.target.value as any);
                                      } else {
                                        updateStoreOrderStatus(order.id, e.target.value as any);
                                      }
                                    }}
                                    className="!py-1 !px-2 !text-xs w-full shadow-2xs font-medium"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="preparing">Preparing</option>
                                    <option value="ready">Ready</option>
                                    {order.orderType === 'delivery' && <option value="out_for_delivery">Out for Delivery</option>}
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </AdminSelect>
                                </td>

                                <td className="px-3 py-2.5 text-right align-middle">
                                  <button
                                    onClick={() => setSelectedOrderDetails(order)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-[#63131d] bg-white px-2.5 py-1.5 rounded-lg border border-[#63131d]/20 shadow-2xs hover:bg-[#fff9f6] transition-colors cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredActive.map((order) => (
                          <div key={order.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-[#63131d]">{order.orderId}</h3>
                                <p className="text-sm font-medium">{order.customerName || "Walk-in"}</p>
                                {order.orderType === 'dine-in' && (order as any).tableNumber && (
                                  <p className="text-[10px] text-stone-500 font-bold mt-0.5">Table: {(order as any).tableNumber}</p>
                                )}
                              </div>
                              <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 border border-gray-200">
                                {order.orderType || "dine-in"}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm border-y border-accent/5 py-2">
                              <span className="text-muted truncate max-w-[60%]">{order.items}</span>
                              <span className="font-bold text-lg text-[#63131d]">₱{order.total?.toFixed(2) || ((order as any).subtotal + ((order as any).deliveryFee||0)).toFixed(2)}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-muted">Status:</span>
                                <AdminSelect
                                  value={order.status}
                                  onChange={(e) => {
                                    if (order.orderType === 'delivery') {
                                      updateDeliveryStatus(order.id, e.target.value as any);
                                    } else {
                                      updateStoreOrderStatus(order.id, e.target.value as any);
                                    }
                                  }}
                                  className="!py-1 !text-xs w-32 shadow-sm"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="preparing">Preparing</option>
                                  <option value="ready">Ready</option>
                                  {order.orderType === 'delivery' && <option value="out_for_delivery">Out for Delivery</option>}
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </AdminSelect>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-muted">Payment:</span>
                                {(order.paid || order.paymentStatus === "paid" || order.status === "completed" || order.status === "delivered") ? (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Paid / Verified
                                  </span>
                                ) : order.paymentStatus === "failed" ? (
                                  <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                    🔴 Payment Failed
                                  </span>
                                ) : order.paymentStatus === "cancelled" ? (
                                  <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                                    ⚪ Cancelled
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                    🔴 Unpaid
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <button
                                onClick={() => setPaymentModalOrder(order)}
                                className="py-2 bg-[#fff9f6] text-[#63131d] font-bold text-xs rounded-lg border border-[#63131d]/20 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                View Payment
                              </button>
                              <button
                                onClick={() => setSelectedOrderDetails(order)}
                                className="py-2 bg-white text-[#63131d] font-bold text-xs rounded-lg border border-stone-200 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" /> Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              </AdminPanel>

              {/* ORDER HISTORY */}
              <AdminPanel title="Customer Order History" subtitle="Fulfilled or cancelled records">
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search history..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={orderHistorySearch}
                      onChange={(e) => setOrderHistorySearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium w-full md:w-auto"
                    value={orderHistoryStatusFilter}
                    onChange={(e) => setOrderHistoryStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl overflow-x-auto">
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 text-muted flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-accent/5 flex items-center justify-center mb-3">
                        <Filter className="h-6 w-6 text-accent/40" />
                      </div>
                      <p className="font-medium text-[#800000]">No history found.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block">
                        <table className="w-full text-left text-sm min-w-[640px]">
                          <thead>
                            <tr className="text-muted border-b border-accent/10">
                              <th className="px-4 py-3 font-medium">Order ID</th>
                              <th className="px-4 py-3 font-medium">Customer</th>
                              <th className="px-4 py-3 font-medium">Time</th>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">Total</th>
                              <th className="px-4 py-3 font-medium">Order Status</th>
                              <th className="px-4 py-3 font-medium">Payment Status</th>
                              <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.map((order) => (
                              <tr key={order.id} className="border-b border-accent/5 hover:bg-accent-light/10 text-[#2B2523]">
                                <td className="px-4 py-3 font-bold">{order.orderId}</td>
                                <td className="px-4 py-3 font-medium">{order.customerName || "Walk-in"}</td>
                                <td className="px-4 py-3 text-xs text-muted">{order.time}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 border border-gray-200">
                                    {order.orderType || "dine-in"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold">₱{order.total?.toFixed(2) || ((order as any).subtotal + ((order as any).deliveryFee||0)).toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'} border`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {(order.paid || order.paymentStatus === "paid") ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Paid / Verified
                                    </span>
                                  ) : order.paymentStatus === "refunded" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-700 border border-stone-200 whitespace-nowrap">
                                      ⚪ Refunded
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200 whitespace-nowrap">
                                      🔴 Unpaid
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setSelectedOrderDetails(order)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline bg-white px-3 py-1.5 rounded-lg border border-accent/10 shadow-sm"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* MOBILE HISTORY CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredHistory.map((order) => (
                          <div key={order.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3 opacity-90">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-[#800000]">{order.orderId}</h3>
                                <p className="text-sm font-medium">{order.customerName || "Walk-in"}</p>
                              </div>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                                {order.status}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm border-y border-accent/5 py-2">
                              <span className="text-muted text-xs">{order.time}</span>
                              <span className="font-bold text-lg">₱{order.total?.toFixed(2) || ((order as any).subtotal + ((order as any).deliveryFee||0)).toFixed(2)}</span>
                            </div>

                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="w-full mt-1 py-2 bg-white text-accent font-bold text-sm rounded-lg border border-accent/10 shadow-sm flex items-center justify-center gap-2"
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AdminPanel>

              {/* ORDER DETAILS MODAL */}
              {selectedOrderDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="bg-[#FFF8F0] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-accent/10 bg-white">
                      <div>
                        <h2 className="font-serif text-2xl font-bold text-[#800000]">Order {selectedOrderDetails.orderId}</h2>
                        <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 mt-1 border border-gray-200 shadow-sm">
                          {selectedOrderDetails.orderType || "Dine-in"}
                        </span>
                      </div>
                      <button 
                        onClick={() => setSelectedOrderDetails(null)}
                        className="p-2 text-muted hover:bg-gray-100 hover:text-[#2B2523] rounded-full transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {/* Body */}
                    <div className="p-5 overflow-y-auto space-y-6">
                      
                      {/* Customer Info */}
                      <div className="bg-white p-5 rounded-xl shadow-sm border border-accent/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                        <h3 className="text-[10px] font-bold uppercase text-muted tracking-wider mb-4">Customer Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Name</p>
                            <p className="font-medium mt-1">{selectedOrderDetails.customerName || "Walk-in Customer"}</p>
                          </div>
                          {selectedOrderDetails.phone && (
                            <div>
                              <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Contact</p>
                              <p className="font-medium mt-1">{selectedOrderDetails.phone}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Date & Time</p>
                            <p className="font-medium mt-1">{selectedOrderDetails.time}</p>
                          </div>
                          <div>
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide">Status</p>
                            <p className="font-bold text-accent capitalize mt-1">{selectedOrderDetails.status}</p>
                          </div>
                        </div>
                        {selectedOrderDetails.orderType === 'delivery' && selectedOrderDetails.address && (
                          <div className="mt-5 pt-4 border-t border-accent/5">
                            <p className="text-muted text-[10px] uppercase font-bold tracking-wide mb-1.5 flex items-center gap-1.5"><MapPin className="h-3 w-3 text-accent" /> Delivery Address</p>
                            <p className="font-medium text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedOrderDetails.address}</p>
                            <button
                              onClick={() => { setSelectedOrderDetails(null); handleOpenChat(selectedOrderDetails.customerName, selectedOrderDetails.orderId); }}
                              className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-accent/5 text-accent font-bold text-sm rounded-lg border border-accent/10 hover:bg-accent/10 hover:shadow-sm transition-all"
                            >
                              <MessageCircle className="h-4 w-4" /> Chat with Customer
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Order Items */}
                      <div>
                        <h3 className="text-[10px] font-bold uppercase text-muted tracking-wider mb-3 px-1">Order Summary</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-accent/5 overflow-hidden">
                          <div className="p-5 space-y-4">
                            <div className="flex flex-col gap-2 text-sm text-[#2B2523] font-medium leading-relaxed">
                              {selectedOrderDetails.items}
                            </div>
                          </div>
                          
                          <div className="bg-accent-light/30 p-5 border-t border-accent/10 space-y-3 text-sm">
                            {selectedOrderDetails.orderType === 'delivery' && (
                              <>
                                <div className="flex justify-between text-muted font-medium">
                                  <span>Subtotal</span>
                                  <span>₱{(selectedOrderDetails as any).subtotal?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted font-medium">
                                  <span>Delivery Fee</span>
                                  <span>₱{(selectedOrderDetails as any).deliveryFee?.toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-accent/10 w-full my-2"></div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#800000]">Total</span>
                              <span className="font-serif font-bold text-2xl text-[#2B2523]">₱{selectedOrderDetails.total?.toFixed(2) || ((selectedOrderDetails as any).subtotal + ((selectedOrderDetails as any).deliveryFee||0)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Note — from actual customer order data */}
                      {(selectedOrderDetails as any).notes && String((selectedOrderDetails as any).notes).trim().length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                          <h3 className="text-[10px] font-bold uppercase text-amber-700 tracking-wider mb-2 flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Customer Note
                          </h3>
                          <p className="text-sm font-semibold text-amber-950 italic leading-relaxed break-words whitespace-pre-wrap">
                            {String((selectedOrderDetails as any).notes).trim()}
                          </p>
                        </div>
                      )}

                      {/* Payment Status */}
                      <div className="flex justify-between items-center p-5 bg-white rounded-xl shadow-sm border border-accent/5">
                        <span className="text-sm font-bold text-[#2B2523] uppercase tracking-wide">Payment Status</span>
                        {(selectedOrderDetails.paid || selectedOrderDetails.paymentStatus === "paid" || selectedOrderDetails.status === "completed" || selectedOrderDetails.status === "delivered") ? (
                          <span className="px-4 py-1.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-full border border-emerald-200 shadow-2xs flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Paid / Verified
                          </span>
                        ) : selectedOrderDetails.paymentStatus === "failed" ? (
                          <span className="px-4 py-1.5 bg-rose-50 text-rose-800 font-bold text-xs rounded-full border border-rose-200 shadow-2xs flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span> Payment Failed
                          </span>
                        ) : (
                          <span className="px-4 py-1.5 bg-rose-50 text-rose-800 font-bold text-xs rounded-full border border-rose-200 shadow-2xs flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span> Unpaid
                          </span>
                        )}
                      </div>

                      {(!selectedOrderDetails.paid && selectedOrderDetails.paymentStatus !== "paid" && selectedOrderDetails.status !== "completed" && selectedOrderDetails.status !== "delivered") && (
                        <div className="mt-4 pt-4 border-t border-accent/10">
                          <button
                            onClick={() => {
                              if (!activeCashShift) {
                                setStartShiftOpen(true);
                              } else {
                                setCashPaymentOrder(selectedOrderDetails);
                              }
                            }}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md"
                          >
                            Receive Cash Payment
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "menu" && (() => {
          // Process data
          const activeMenuItems = menuItems.filter(m => !m.archived);
          
          // Summary counts
          const summary = {
            total: activeMenuItems.length,
            available: activeMenuItems.filter(m => m.available).length,
            unavailable: activeMenuItems.filter(m => !m.available).length,
            lowStock: activeMenuItems.filter(m => {
              // Basic check if a stock item name matches item name or is a substring
              // A real system would use a mapping/recipe
              const relatedStock = stockItems.find(s => m.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(m.name.toLowerCase()));
              return relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;
            }).length
          };

          // Filter & Sort
          let filteredMenu = activeMenuItems.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(menuSearch.toLowerCase()) || 
                                  m.description.toLowerCase().includes(menuSearch.toLowerCase());
            const matchesCat = menuCatFilter === "all" || m.categoryId === menuCatFilter;
            const matchesAvail = menuAvailFilter === "all" || (menuAvailFilter === "available" ? m.available : !m.available);
            return matchesSearch && matchesCat && matchesAvail;
          });

          filteredMenu.sort((a, b) => {
            if (menuSort === "name-asc") return a.name.localeCompare(b.name);
            if (menuSort === "name-desc") return b.name.localeCompare(a.name);
            if (menuSort === "price-asc") return a.price - b.price;
            if (menuSort === "price-desc") return b.price - a.price;
            return 0;
          });

          return (
            <div className="space-y-6">
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Menu</span>
                  <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Menu Items</h1>
                  <p className="text-sm text-muted">Manage your cafeé menu, availability, pricing, and item details.</p>
                </div>
                <button 
                  onClick={openAddMenu}
                  className="inline-flex items-center justify-center gap-2 bg-[#800000] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#600000] transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Menu Item
                </button>
              </div>

              {/* SUMMARY ROW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Items", value: summary.total, color: "text-[#800000]" },
                  { label: "Available", value: summary.available, color: "text-green-700" },
                  { label: "Unavailable", value: summary.unavailable, color: "text-amber-600" },
                  { label: "Low Stock", value: summary.lowStock, color: "text-red-600" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/40 shadow-sm flex flex-col">
                    <p className="text-xs font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-2xl font-bold font-serif mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* MENU ITEMS PANEL */}
              <AdminPanel title="Menu Catalog" subtitle="Active menu items visible to customers">
                {/* FILTERS TOOLBAR */}
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                  <div className="relative w-full lg:w-72 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search menu items..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuCatFilter}
                      onChange={(e) => setMenuCatFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {menuCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuAvailFilter}
                      onChange={(e) => setMenuAvailFilter(e.target.value)}
                    >
                      <option value="all">All Availability</option>
                      <option value="available">Available</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuSort}
                      onChange={(e) => setMenuSort(e.target.value)}
                    >
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                      <option value="price-asc">Price Low-High</option>
                      <option value="price-desc">Price High-Low</option>
                    </select>
                  </div>
                </div>

                {/* CONTENT AREA */}
                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl">
                  {activeMenuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center mb-4">
                        <Plus className="h-8 w-8 text-accent/40" />
                      </div>
                      <p className="text-lg font-bold text-[#800000]">No menu items found.</p>
                      <p className="text-sm text-muted mt-1 max-w-xs">Start building your menu by adding your first item.</p>
                      <button 
                        onClick={openAddMenu}
                        className="mt-4 px-4 py-2 bg-accent/10 text-accent font-bold text-sm rounded-lg hover:bg-accent/20 transition-colors"
                      >
                        Add Menu Item
                      </button>
                    </div>
                  ) : filteredMenu.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Filter className="h-8 w-8 text-muted/30 mb-3" />
                      <p className="font-bold text-[#2B2523]">No matching menu items.</p>
                      <p className="text-sm text-muted mt-1">Try changing your search or filters.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-muted border-b border-accent/10">
                              <th className="px-4 py-3 font-medium">Item</th>
                              <th className="px-4 py-3 font-medium">Category</th>
                              <th className="px-4 py-3 font-medium">Price</th>
                              <th className="px-4 py-3 font-medium">Stock</th>
                              <th className="px-4 py-3 font-medium">Availability</th>
                              <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMenu.map((item) => {
                              const relatedStock = stockItems.find(s => item.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(item.name.toLowerCase()));
                              const isLowStock = relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;

                              return (
                                <tr key={item.id} className="border-b border-accent/5 hover:bg-accent-light/20 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      {item.image ? (
                                        <img src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-accent/10 shadow-sm" />
                                      ) : (
                                        <div className="h-10 w-10 shrink-0 rounded-lg bg-accent/5 text-accent flex items-center justify-center font-bold text-sm">
                                          {item.name.charAt(0)}
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-bold text-[#2B2523]">{item.name}</p>
                                        <p className="text-[10px] text-muted font-normal mt-0.5 line-clamp-1 max-w-[200px]">{item.description}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 border border-gray-200">
                                      {getMenuCategoryName(item.categoryId)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-serif font-bold text-[#800000]">₱{item.price.toFixed(2)}</td>
                                  <td className="px-4 py-3">
                                    {isLowStock ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600"><AlertTriangle className="h-3 w-3" /> Low Stock</span>
                                    ) : relatedStock ? (
                                      <span className="text-[10px] text-muted">In Stock</span>
                                    ) : (
                                      <span className="text-[10px] text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {item.available ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div> Available
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div> Unavailable
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end items-center gap-2">
                                      <button
                                        onClick={() => handleToggleAvailability(item)}
                                        className="p-1.5 text-muted hover:text-[#2B2523] hover:bg-white rounded-md transition-colors"
                                        title={item.available ? "Mark Unavailable" : "Mark Available"}
                                      >
                                        <Eye className={`h-4 w-4 ${!item.available ? "opacity-40" : ""}`} />
                                      </button>
                                      <button
                                        onClick={() => openEditMenu(item)}
                                        className="p-1.5 text-accent hover:bg-accent-light rounded-md transition-colors"
                                        title="Edit Item"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => setItemToArchive(item)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Archive Item"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredMenu.map((item) => {
                          const relatedStock = stockItems.find(s => item.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(item.name.toLowerCase()));
                          const isLowStock = relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;
                          
                          return (
                            <div key={item.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                              {!item.available && <div className="absolute top-0 left-0 w-1 h-full bg-gray-300"></div>}
                              <div className="flex gap-3">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover border border-accent/10 shadow-sm" />
                                ) : (
                                  <div className="h-16 w-16 shrink-0 rounded-lg bg-accent/5 text-accent flex items-center justify-center font-bold text-xl">
                                    {item.name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <h3 className={`font-bold ${item.available ? 'text-[#800000]' : 'text-gray-500'}`}>{item.name}</h3>
                                  </div>
                                  <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 border border-gray-100 mt-1">
                                    {getMenuCategoryName(item.categoryId)}
                                  </span>
                                  <p className="text-xs text-muted font-normal mt-1 line-clamp-2">{item.description}</p>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center text-sm border-t border-accent/5 pt-3 mt-1">
                                <div className="flex flex-col">
                                  {isLowStock && <span className="text-[10px] font-bold text-red-600 mb-0.5">Low Stock</span>}
                                  {item.available ? (
                                    <span className="text-[10px] font-bold uppercase text-green-600">Available</span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase text-gray-500">Unavailable</span>
                                  )}
                                </div>
                                <span className="font-serif font-bold text-lg text-[#2B2523]">₱{item.price.toFixed(2)}</span>
                              </div>

                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => handleToggleAvailability(item)}
                                  className="flex-1 py-2 bg-gray-50 text-[#2B2523] font-bold text-xs rounded-lg border border-gray-200 shadow-sm"
                                >
                                  {item.available ? "Mark Unavailable" : "Mark Available"}
                                </button>
                                <button
                                  onClick={() => openEditMenu(item)}
                                  className="flex-1 py-2 bg-accent/5 text-accent font-bold text-xs rounded-lg border border-accent/10 shadow-sm"
                                >
                                  Edit Item
                                </button>
                                <button
                                  onClick={() => setItemToArchive(item)}
                                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg border border-red-100 shadow-sm"
                                >
                                  <Archive className="h-4 w-4 mx-auto" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </AdminPanel>

              {/* ARCHIVE CONFIRMATION MODAL */}
              {itemToArchive && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-[#2B2523] mb-2">Archive Menu Item?</h3>
                    <p className="text-sm text-muted mb-6">
                      Are you sure you want to archive <strong>{itemToArchive.name}</strong>? This item will no longer appear in the active menu.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setItemToArchive(null)}
                        className="flex-1 py-2.5 bg-gray-100 text-[#2B2523] font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          archiveMenuItem(itemToArchive.id);
                          setItemToArchive(null);
                        }}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                      >
                        Archive Item
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <StaffInventoryTab
            stockItems={stockItems}
            stockCategories={stockCategories}
            getStockCategoryName={getStockCategoryName}
            addStockItem={addStockItem}
            updateStockItem={updateStockItem}
            deleteStockItem={deleteStockItem}
            staffName={user?.name || "Staff"}
          />
        )}

                {/* TAB: ARCHIVE */}
        {activeTab === "archive" && (
          <ArchiveTab />
        )}

        {/* TAB 5: DELIVERY ORDERS */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#63131d] border border-[#63131d]/10">
                Deliveries
              </span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#63131d] mt-1.5">
                Delivery Orders
              </h1>
              <p className="text-sm text-stone-500 mt-1">
                View delivery addresses, item manifests, courier assignments, and update live progress status.
              </p>
            </div>

            <DeliveryOrdersTable
              orders={deliveryOrders}
              getServiceAreaName={getServiceAreaName}
              showStatusControl={true}
              onStatusChange={updateDeliveryStatus}
              onDeliveryPersonChange={updateDeliveryPerson}
              onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}
              isAdmin={user?.role === "admin"}
            />
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Profile</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">My Account Settings</h1>
              <p className="text-sm text-muted">Update your staff profile credentials and password.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminPanel title="Profile Details" subtitle="Full Name and contact details">
                <form onSubmit={handleProfileUpdate} className="space-y-4 px-6 py-5">
                  {profileError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-800">
                      {profileSuccess}
                    </div>
                  )}
                  <AdminField label="Full Name">
                    <AdminInput
                      value={profileName}
                      onChange={(e) => {
                        setProfileName(e.target.value);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. Maria Santos"
                      required
                    />
                  </AdminField>
                  <AdminField label="Username">
                    <AdminInput
                      value={profileUsername}
                      onChange={(e) => {
                        setProfileUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. maria"
                      required
                    />
                  </AdminField>
                  <AdminField label="Email Address">
                    <AdminInput
                      type="email"
                      value={profileEmail}
                      onChange={(e) => {
                        setProfileEmail(e.target.value);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. maria@eatnrepeat.com"
                      required
                    />
                  </AdminField>
                  <div className="pt-2 flex justify-end">
                    <AdminButton type="submit">Update Profile</AdminButton>
                  </div>
                </form>
              </AdminPanel>

              <AdminPanel title="Security Settings" subtitle="Change account password">
                <form onSubmit={handlePasswordUpdate} className="space-y-4 px-6 py-5">
                  {pwdError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">
                      {pwdError}
                    </div>
                  )}
                  {pwdSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-800">
                      {pwdSuccess}
                    </div>
                  )}
                  <AdminField label="Current Password">
                    <AdminInput
                      type="password"
                      value={currentPwd}
                      onChange={(e) => {
                        setCurrentPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <AdminField label="New Password">
                    <AdminInput
                      type="password"
                      value={newPwd}
                      onChange={(e) => {
                        setNewPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <AdminField label="Confirm New Password">
                    <AdminInput
                      type="password"
                      value={confirmNewPwd}
                      onChange={(e) => {
                        setConfirmNewPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <div className="pt-2 flex justify-end">
                    <AdminButton type="submit">Update Password</AdminButton>
                  </div>
                </form>
              </AdminPanel>
            </div>
          </div>
        )}

        {/* TAB: POS CASHIER */}
        {activeTab === "pos" && (
          <POSCashierTab
            menuItems={menuItems}
            menuCategories={menuCategories}
            getMenuCategoryName={getMenuCategoryName}
            addStoreOrder={addStoreOrder}
            stockItems={stockItems}
            updateStockItem={updateStockItem}
            staffName={user?.name || "Cashier"}
          />
        )}
      </main>

      {/* ADD/EDIT MENU ITEM MODAL */}
      <AdminModal
        open={menuModalOpen}
        title={editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}
        onClose={() => setMenuModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setMenuModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleMenuSubmit}>
              {editingMenuItem ? "Save Changes" : "Add Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Item Name">
            <AdminInput
              value={menuForm.name}
              onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
              placeholder="e.g. Mocha Latte"
              required
            />
          </AdminField>
          <AdminField label="Description">
            <AdminTextarea
              value={menuForm.description}
              onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
              placeholder="e.g. Rich espresso with dark cocoa and chocolate dust."
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Category">
              <AdminSelect
                value={menuForm.categoryId}
                onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
              >
                {menuCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Price (PHP)">
              <AdminInput
                type="number"
                min={1}
                value={menuForm.price}
                onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })}
                required
              />
            </AdminField>
          </div>
          <AdminField label="Item Picture">
            <div className="mt-1 flex items-center gap-4">
              {menuForm.image ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-accent/15">
                  <img src={menuForm.image} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMenuForm({ ...menuForm, image: "" })}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity text-xs font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-accent/25 bg-accent-light/10 text-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setMenuForm(prev => ({ ...prev, image: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent hover:file:bg-accent/20 cursor-pointer"
                />
                <p className="mt-1 text-[10px] text-muted">PNG, JPG, or GIF. Max size 2MB.</p>
              </div>
            </div>
          </AdminField>
        </div>
      </AdminModal>

      {activeChatOrder && (
        <AdminChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          customerName={activeChatOrder.customerName}
          orderId={activeChatOrder.orderNumber}
        />
      )}

      {paymentModalOrder && (
        <PaymentDetailsModal
          open={!!paymentModalOrder}
          onClose={() => setPaymentModalOrder(null)}
          order={paymentModalOrder}
        />
      )}

      <StartShiftModal open={startShiftOpen} onStart={handleStartShift} />
      <EndShiftModal open={endShiftOpen} shift={activeCashShift} onEnd={handleEndShift} onClose={() => setEndShiftOpen(false)} />
      <CashPaymentModal open={!!cashPaymentOrder} order={cashPaymentOrder} onConfirm={handleConfirmCashPayment} onClose={() => { setCashPaymentOrder(null); setSelectedOrderDetails(null); }} />
    </div>
  );
}
