"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { Logo } from "@/components/brand/Logo";
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
import { StatCard, DollarIcon, ClipboardIcon, TrendIcon } from "@/components/admin/StatCard";
import type { MenuItem, MenuItemInput, StaffRole, DeliveryStatus } from "@/lib/admin/types";

type StaffTab = "dashboard" | "orders" | "menu" | "inventory" | "delivery" | "profile" | "pos";

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
    getMenuCategoryName,
    getStockCategoryName,
    staffAccounts,
  } = useAdminData();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");

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
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
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
        id: "delivery",
        label: "Delivery Orders",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <rect x="1" y="3" width="15" height="13" rx="1" />
            <path d="M16 8h4l3 4v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
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
    <div className="admin-shell min-h-screen flex text-[#1c1c1c]">
      {/* LEFT SIDEBAR */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white">
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
              onClick={() => setActiveTab(tab.id)}
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

      {/* MAIN MAIN AREA */}
      <main className="relative z-10 pl-72 flex-1 mx-auto max-w-6xl px-8 py-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <>
          <div className="space-y-5">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/85 px-5 py-5 shadow-[0_20px_60px_-42px_rgba(74,20,28,0.5)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">Staff workspace</p>
                <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#63131d] sm:text-4xl">Good day, {user.name.split(" ")[0]}!</h1>
                <p className="mt-2 text-sm text-muted">Here&apos;s your café pulse for today.</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-accent/10 bg-[#fffaf7] px-3 py-2.5">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7b1726] to-[#c53a50] font-serif text-lg font-bold text-white shadow-lg">{user.name.slice(0, 1).toUpperCase()}{stockNotifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-sans font-bold">{stockNotifications.length}</span>}</div>
                <div className="pr-2"><p className="text-sm font-bold text-[#63131d]">{user.name}</p><p className="text-xs capitalize text-muted">{user.role.replace("_", " ")}</p></div>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Today's Orders", value: salesSummary.totalOrders, note: "All order channels", color: "bg-[#fff0ea] text-[#8b3b25]", icon: "▣" },
                { label: "Pending Orders", value: salesSummary.pendingOrders, note: "Needs attention", color: "bg-[#fff5dc] text-[#9a6100]", icon: "◷" },
                { label: "Completed", value: salesSummary.completedOrders, note: "Served or delivered", color: "bg-[#eaf8ed] text-[#24753c]", icon: "✓" },
                { label: "Low Stock", value: stockNotifications.length, note: "Ingredients to watch", color: "bg-[#fff0f0] text-[#bd2525]", icon: "!" },
              ].map((stat) => <div key={stat.label} className="rounded-2xl border border-[#eaded8] bg-white/80 p-4 shadow-[0_14px_34px_-30px_rgba(55,20,20,0.55)]"><div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold ${stat.color}`}>{stat.icon}</span><span className="text-[11px] font-semibold text-muted">Live</span></div><p className="mt-4 text-sm font-medium text-ink">{stat.label}</p><p className="mt-1 font-serif text-3xl font-bold text-[#63131d]">{stat.value}</p><p className="mt-1 text-xs text-muted">{stat.note}</p></div>)}
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
              <AdminPanel title="Today’s Orders" subtitle="Latest in-store tickets" action={<button onClick={() => setActiveTab("orders")} className="text-xs font-bold text-accent hover:underline">View all</button>}>
                <div className="divide-y divide-accent/10 px-5">{storeOrders.filter((order) => !order.archived).slice(0, 5).map((order) => <div key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 text-sm"><span className="font-bold text-[#63131d]">{order.orderId}</span><span className="min-w-[110px] flex-1 text-xs text-muted">{order.items}</span><span className="font-semibold">₱{order.total}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${order.status === "completed" ? "bg-green-100 text-green-700" : order.status === "cancelled" ? "bg-stone-100 text-stone-600" : "bg-amber-100 text-amber-800"}`}>{order.status}</span></div>)}{storeOrders.filter((order) => !order.archived).length === 0 && <p className="py-9 text-center text-sm text-muted">No orders have arrived yet.</p>}</div>
              </AdminPanel>
              <div className="space-y-5">
                <AdminPanel title="Inventory alerts" subtitle="Ingredients needing attention" action={<button onClick={() => setActiveTab("inventory")} className="text-xs font-bold text-accent hover:underline">Open stock</button>}>
                  <div className="divide-y divide-accent/10 px-5">{stockNotifications.slice(0, 3).map((alert) => <div key={alert.id} className="flex gap-3 py-3.5"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-sm font-bold text-red-600">!</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#63131d]">{alert.title.replace("Low stock: ", "")}</p><p className="mt-0.5 text-xs text-muted">{alert.details}</p></div></div>)}{stockNotifications.length === 0 && <p className="py-7 text-center text-sm text-muted">All ingredients are within their stock levels.</p>}</div>
                </AdminPanel>
                <AdminPanel title="Quick actions" subtitle="Jump into your shift"><div className="grid grid-cols-3 gap-2 px-4 py-4 text-center text-[11px] font-semibold text-[#63131d]">{[{ label: "Orders", icon: "▣", action: () => setActiveTab("orders") }, { label: "Stock", icon: "□", action: () => setActiveTab("inventory") }, { label: "Menu", icon: "☷", action: () => setActiveTab("menu") }].map((action, index) => <button key={action.label} onClick={action.action} className="group flex flex-col items-center gap-2 rounded-xl py-1.5 hover:bg-accent-light"><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${["bg-rose-50 text-accent", "bg-emerald-50 text-emerald-700", "bg-amber-50 text-amber-700"][index]}`}>{action.icon}</span>{action.label}</button>)}</div></AdminPanel>
              </div>
            </section>

          </div>
          </>
        )}

        {/* TAB 2: CUSTOMER ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Operations</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">In-store Orders</h1>
              <p className="text-sm text-muted">Manage in-store customer tickets, update workflow status, and confirm payments.</p>
            </div>

            <AdminPanel title="Active Orders Tickets" subtitle="Awaiting prep or completion">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">ID</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeOrders.filter(o => !o.archived && o.status !== "completed").length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted">No active order tickets.</td>
                      </tr>
                    ) : (
                      storeOrders.filter(o => !o.archived && o.status !== "completed").map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-bold text-[#800000]">{order.orderId}</td>
                          <td className="px-4 py-3 text-muted text-xs">{order.time}</td>
                          <td className="px-4 py-3 text-xs font-medium">{order.items}</td>
                          <td className="px-4 py-3 font-semibold">₱{order.total}</td>
                          <td className="px-4 py-3">
                            {order.paid ? (
                              <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Paid</span>
                            ) : (
                              <button
                                onClick={() => confirmStoreOrderPayment(order.id)}
                                className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-green-100 hover:text-green-800 transition-colors cursor-pointer"
                              >
                                Confirm Payment
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-red-50 text-accent border border-accent/15 px-2.5 py-0.5 text-xs font-semibold capitalize">
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 flex gap-2 items-center">
                            <AdminSelect
                              value={order.status}
                              onChange={(e) => updateStoreOrderStatus(order.id, e.target.value as any)}
                              className="!py-1 !text-xs max-w-28"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </AdminSelect>
                            <button
                              type="button"
                              onClick={() => handleOpenChat(`Customer #${order.orderId}`, order.orderId)}
                              className="p-1.5 text-accent hover:bg-accent-light rounded-lg transition-colors cursor-pointer focus:outline-none"
                              title="Chat with Customer"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>

            <AdminPanel title="Customer Order History" subtitle="Fulfilled or cancelled records">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">ID</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg">Final Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeOrders.filter(o => o.status === "completed" || o.status === "cancelled").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted">No history found.</td>
                      </tr>
                    ) : (
                      storeOrders.filter(o => o.status === "completed" || o.status === "cancelled").map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-muted">
                          <td className="px-4 py-3 font-bold">{order.orderId}</td>
                          <td className="px-4 py-3 text-xs">{order.time}</td>
                          <td className="px-4 py-3 text-xs">{order.items}</td>
                          <td className="px-4 py-3 font-semibold text-ink">₱{order.total}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Confirmed Paid</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              order.status === "completed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 3: MENU ITEMS */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Menu</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Menu Management</h1>
              <p className="text-sm text-muted">Add, edit, or adjust the live availability of café items.</p>
            </div>

            <AdminPanel
              title="Café Menu Catalog"
              subtitle={`${menuItems.filter(m => !m.archived).length} menu items`}
              action={<AdminButton onClick={openAddMenu}>+ Add Menu Item</AdminButton>}
            >
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Item Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Availability Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.filter(m => !m.archived).map((item) => (
                      <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                        <td className="px-4 py-3 font-medium text-[#800000]">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-accent/10 shadow-sm" />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-accent/5 text-accent flex items-center justify-center font-bold text-sm">
                                {item.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p>{item.name}</p>
                              <p className="text-[10px] text-muted font-normal mt-0.5">{item.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{getMenuCategoryName(item.categoryId)}</td>
                        <td className="px-4 py-3 font-semibold">₱{item.price}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all cursor-pointer ${
                              item.available
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                            }`}
                          >
                            {item.available ? "● Available" : "○ Out of Stock"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEditMenu(item)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-light transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Inventory</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Stock Levels</h1>
              <p className="text-sm text-muted">View ingredient levels. Staff cannot manually reduce stock.</p>
            </div>

            <AdminPanel title="Raw Ingredients & Stock Items" subtitle="Read-only stock levels for staff">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Ingredient</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Alert Level</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-center">Remaining Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item) => {
                      const isLow = item.quantity <= item.lowStockThreshold;
                      return (
                        <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-muted">{getStockCategoryName(item.categoryId)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${
                              isLow ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-green-50 text-green-800 border-green-200"
                            }`}>
                              {isLow ? `Low stock (<=${item.lowStockThreshold})` : "Optimal"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-sm">
                            {item.quantity} <span className="text-xs font-normal text-muted">{item.unit}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 5: DELIVERY ORDERS */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Deliveries</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Delivery Orders</h1>
              <p className="text-sm text-muted">View delivery addresses, item manifests, and update progress status.</p>
            </div>

            <AdminPanel title="Active Deliveries Queue" subtitle="Monitoring café home-deliveries">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Order ID</th>
                      <th className="px-4 py-3 font-medium">Customer Details</th>
                      <th className="px-4 py-3 font-medium">Manifest</th>
                      <th className="px-4 py-3 font-medium">Total Price</th>
                      <th className="px-4 py-3 font-medium">Delivery Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.filter(o => !o.archived).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted">No delivery orders listed.</td>
                      </tr>
                    ) : (
                      deliveryOrders.filter(o => !o.archived).map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-bold text-[#800000]">{order.orderNumber}</td>
                          <td className="px-4 py-3 text-xs leading-4">
                            <p className="font-bold text-ink">{order.customerName}</p>
                            <p className="text-muted">{order.phone}</p>
                            <p className="text-muted mt-0.5">{order.address}</p>
                            <button
                              type="button"
                              onClick={() => handleOpenChat(order.customerName, order.orderNumber)}
                              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:underline cursor-pointer focus:outline-none"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              Chat with Customer
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs">{order.items}</td>
                          <td className="px-4 py-3 font-semibold">₱{order.total}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                              order.status === "delivered"
                                ? "bg-green-50 text-green-800 border-green-200"
                                : order.status === "cancelled"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : "bg-red-50 text-accent border-accent/15"
                            }`}>
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdminSelect
                              value={order.status}
                              onChange={(e) => updateDeliveryStatus(order.id, e.target.value as DeliveryStatus)}
                              className="!py-1 !text-xs max-w-32 inline-block"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="preparing">Preparing</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </AdminSelect>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
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
          <div className="space-y-5">
            <header>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Point of Sale</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">POS Cashier</h1>
              <p className="text-sm text-muted">Process walk-in transactions, calculate change, and generate receipts.</p>
            </header>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              {/* LEFT: Menu Item Picker */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <AdminInput
                      type="text"
                      value={posSearchTerm}
                      onChange={(e) => setPosSearchTerm(e.target.value)}
                      placeholder="Search menu items..."
                    />
                  </div>
                  <div className="min-w-[140px]">
                    <AdminSelect value={posCategoryFilter} onChange={(e) => setPosCategoryFilter(e.target.value)}>
                      <option value="all">All Categories</option>
                      {menuCategories.filter((c) => !c.archived).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </AdminSelect>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {posFilteredItems.length === 0 ? (
                    <p className="col-span-full text-center py-12 text-sm text-muted">No menu items found.</p>
                  ) : (
                    posFilteredItems.map((item) => {
                      const inCart = posCart.find((ci) => ci.item.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => posAddToCart(item)}
                          className="group relative flex items-center gap-3 rounded-xl border border-accent/10 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md hover:border-[#800000]/30 active:scale-[0.98] cursor-pointer"
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-11 w-11 shrink-0 rounded-lg object-cover border border-accent/5 shadow-sm" />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#800000]/10 to-[#800000]/5 text-[#800000] font-serif font-bold text-lg">
                              {item.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                            <p className="text-xs text-muted">{getMenuCategoryName(item.categoryId)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-[#800000] text-sm">₱{item.price.toFixed(2)}</p>
                            {inCart && (
                              <span className="inline-flex items-center justify-center rounded-full bg-[#800000] text-white text-[10px] font-bold h-5 min-w-5 px-1">
                                {inCart.qty}
                              </span>
                            )}
                          </div>
                          <span className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-[#800000]/20 pointer-events-none transition-all" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Cart & Transaction */}
              <div className="space-y-4">
                <AdminPanel title="Current Transaction" subtitle={posCart.length > 0 ? `${posCart.reduce((s, c) => s + c.qty, 0)} item(s)` : "No items yet"}>
                  <div className="px-4 py-3">
                    {posCart.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-4xl mb-3">🛒</p>
                        <p className="text-sm text-muted">Tap menu items on the left to add them to the cart.</p>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-[280px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted border-b border-accent/10">
                                <th className="text-left py-2 font-medium">Item</th>
                                <th className="text-center py-2 font-medium w-24">Qty</th>
                                <th className="text-right py-2 font-medium">Total</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-accent/5">
                              {posCart.map((ci) => (
                                <tr key={ci.item.id} className="text-ink">
                                  <td className="py-2.5">
                                    <p className="font-semibold text-xs">{ci.item.name}</p>
                                    <p className="text-[10px] text-muted">₱{ci.item.price.toFixed(2)} each</p>
                                  </td>
                                  <td className="py-2.5">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => posUpdateQty(ci.item.id, ci.qty - 1)} className="h-6 w-6 rounded bg-accent/10 text-[#800000] font-bold text-xs hover:bg-accent/20 transition-colors cursor-pointer">−</button>
                                      <span className="w-6 text-center font-bold text-xs">{ci.qty}</span>
                                      <button onClick={() => posUpdateQty(ci.item.id, ci.qty + 1)} className="h-6 w-6 rounded bg-accent/10 text-[#800000] font-bold text-xs hover:bg-accent/20 transition-colors cursor-pointer">+</button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-xs text-[#800000]">₱{(ci.item.price * ci.qty).toFixed(2)}</td>
                                  <td className="py-2.5">
                                    <button onClick={() => posRemoveFromCart(ci.item.id)} className="text-red-400 hover:text-red-600 transition-colors cursor-pointer" title="Remove">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-accent/10 pt-3 mt-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted">Subtotal</span>
                            <span className="font-semibold">₱{posSubtotal.toFixed(2)}</span>
                          </div>
                          {posTax > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted">Tax ({(posTaxRate * 100).toFixed(0)}%)</span>
                              <span className="font-semibold">₱{posTax.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-bold border-t border-dashed border-accent/20 pt-2">
                            <span className="text-[#800000]">TOTAL</span>
                            <span className="text-[#800000]">₱{posTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Tendered */}
                        <div className="mt-4 space-y-3">
                          <AdminField label="Amount Tendered (₱)">
                            <AdminInput
                              type="number"
                              min={0}
                              step="0.01"
                              value={posTendered}
                              onChange={(e) => setPosTendered(e.target.value)}
                              placeholder="Enter amount given by customer..."
                            />
                          </AdminField>

                          {posTendered && (
                            <div className={`rounded-xl p-3 text-center font-bold text-sm ${
                              posChange >= 0
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-600 border border-red-200"
                            }`}>
                              {posChange >= 0
                                ? `Change: ₱${posChange.toFixed(2)}`
                                : `Insufficient: ₱${Math.abs(posChange).toFixed(2)} short`
                              }
                            </div>
                          )}

                          {/* Change Denomination Preview */}
                          {posTendered && posChange > 0 && (
                            <div className="rounded-xl border border-accent/10 bg-[#fffaf7] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Change Breakdown</p>
                              <div className="flex flex-wrap gap-1.5">
                                {breakdownChange(posChange).map((d) => (
                                  <span key={d.label} className="inline-flex items-center gap-1 rounded-full bg-white border border-accent/15 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
                                    <span className="text-[#800000] font-bold">{d.count}×</span> {d.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={posClearCart}
                            className="flex-1 py-2.5 rounded-xl border border-accent/20 text-sm font-semibold text-muted hover:bg-accent/5 transition-colors cursor-pointer"
                          >
                            Clear Cart
                          </button>
                          <button
                            onClick={posCompleteTransaction}
                            disabled={posCart.length === 0 || posTenderedNum < posTotal || !posTendered}
                            className="flex-[2] py-2.5 rounded-xl bg-[#800000] text-white text-sm font-bold shadow-md hover:bg-[#6b0000] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Complete Transaction
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </AdminPanel>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* POS RECEIPT MODAL */}
      <AdminModal
        open={posReceiptOpen}
        title="Transaction Receipt"
        onClose={() => setPosReceiptOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => { if (typeof window !== "undefined") window.print(); }}>Print Receipt</AdminButton>
            <AdminButton onClick={posNewTransaction}>New Transaction</AdminButton>
          </>
        }
      >
        {posReceiptData && (
          <div className="font-mono text-xs text-ink bg-white rounded-xl border border-accent/10 p-5 max-w-[320px] mx-auto shadow-inner">
            {/* Header */}
            <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              <p className="font-serif text-lg font-bold text-[#800000] not-italic">Eat n&apos; Repeat Café</p>
              <p className="text-[10px] text-muted mt-0.5">Cordova Branch</p>
              <p className="text-[10px] text-muted">Tel: (032) 555-1234</p>
              <p className="text-[10px] text-muted mt-1">{posReceiptData.date}</p>
              <p className="text-[10px] text-muted">{posReceiptData.time}</p>
              <p className="text-[10px] text-muted mt-1">Receipt #: {posReceiptData.receiptNo}</p>
              <p className="text-[10px] text-muted">Cashier: {posReceiptData.cashier}</p>
            </div>

            {/* Items */}
            <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1">
              <div className="flex justify-between font-bold text-[10px] text-muted uppercase">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {posReceiptData.cart.map((ci) => (
                <div key={ci.item.id}>
                  <div className="flex justify-between">
                    <span className="truncate mr-2">{ci.item.name}</span>
                    <span className="shrink-0 font-semibold">₱{(ci.item.price * ci.qty).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted pl-2">{ci.qty} × ₱{ci.item.price.toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 border-b border-dashed border-gray-300 pb-3 mb-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₱{posReceiptData.subtotal.toFixed(2)}</span>
              </div>
              {posReceiptData.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>₱{posReceiptData.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1">
                <span>TOTAL</span>
                <span>₱{posReceiptData.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Amount Paid</span>
                <span>₱{posReceiptData.tendered.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-700">
                <span>Change</span>
                <span>₱{posReceiptData.change.toFixed(2)}</span>
              </div>
            </div>

            {/* Denomination Breakdown */}
            {posReceiptData.breakdown.length > 0 && (
              <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
                <p className="text-[10px] font-bold text-muted uppercase mb-1">Change Breakdown:</p>
                {posReceiptData.breakdown.map((d) => (
                  <div key={d.label} className="flex justify-between text-[10px]">
                    <span>{d.label}</span>
                    <span>× {d.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-1">
              <p className="font-serif text-xs font-semibold text-[#800000] not-italic">Thank you for dining at</p>
              <p className="font-serif text-sm font-bold text-[#800000] not-italic">Eat n&apos; Repeat!</p>
              <p className="text-[10px] text-muted mt-2">Please come again ♥</p>
              <p className="text-[10px] text-muted mt-1">━━━━━━━━━━━━━━━━━━━━━━</p>
            </div>
          </div>
        )}
      </AdminModal>

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
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-accent/25 bg-accent-light/10 text-accent text-xl">
                  📷
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
    </div>
  );
}
