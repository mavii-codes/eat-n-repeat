"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useNetworkStatus } from "@/context/NetworkStatusContext";
import { isLocalBackend } from "@/lib/config";
import { journalOrder } from "@/lib/offlineSync";
import { StartShiftModal, EndShiftModal } from "@/components/staff/CashModals";
import toast from "react-hot-toast";
import type { MenuItem } from "@/lib/admin/types";
import { getApiUrl } from "@/lib/config";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  ShoppingBag,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Truck,
  FileText,
  CircleDollarSign,
} from "lucide-react";

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

type OrderType = "dine-in" | "takeout" | "delivery";
type PaymentMethod = "cash" | "gcash";

type CartItem = {
  item: MenuItem;
  qty: number;
  notes: string;
};

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export function POSCashierTab() {
  const { user } = useAuth();
  const {
    menuItems,
    menuCategories,
    activeCashShift,
    fetchActiveCashShift,
    addStoreOrder,
    getMenuCategoryName,
  } = useAdminData();
  const { confirm } = useConfirm();
  const { isOffline } = useNetworkStatus();
  const isLocalMode = isLocalBackend();

  // ─── Shift State ───
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [endShiftModalOpen, setEndShiftModalOpen] = useState(false);

  // ─── Menu / Filter State ───
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // ─── Cart & Order State ───
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // ─── Payment State ───
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [gcashConfirmed, setGcashConfirmed] = useState(false);

  // ─── Processing State ───
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Image Fallback ───
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // ─── Refs ───
  const cashInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived data ───
  const activeCategories = useMemo(
    () => menuCategories.filter((c) => !c.archived),
    [menuCategories]
  );

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.archived || !item.available) return false;
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          getMenuCategoryName(item.categoryId).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, categoryFilter, searchTerm, getMenuCategoryName]);

  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.item.price * c.qty, 0),
    [cart]
  );
  const tax = 0; // standard cafe pricing — no tax
  const total = subtotal + tax;
  const tenderedNum = parseFloat(cashTendered) || 0;
  const change = tenderedNum - total;

  const isPaymentValid = useMemo(() => {
    if (cart.length === 0) return false;
    if (paymentMethod === "cash") {
      return tenderedNum >= total && cashTendered.trim() !== "";
    }
    if (paymentMethod === "gcash") {
      return gcashConfirmed;
    }
    return false;
  }, [cart, paymentMethod, tenderedNum, total, cashTendered, gcashConfirmed]);

  // ─── Shift sales tracking (from backend) ───
  const shiftFloat = activeCashShift ? Number(activeCashShift.starting_float) : 0;
  const shiftExpected = activeCashShift ? Number(activeCashShift.expected_cash) : 0;
  const shiftCashSales = activeCashShift ? shiftExpected - shiftFloat : 0;

  // ─── Force GCash off when offline ───
  useEffect(() => {
    if (isOffline && paymentMethod === "gcash") {
      setPaymentMethod("cash");
      toast.error("GCash is unavailable offline. Switched to cash.");
    }
  }, [isOffline, paymentMethod]);

  /* ──────────────────────────────────────────────
     Cart Handlers
     ────────────────────────────────────────────── */

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1, notes: "" }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const updateQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, qty } : ci))
    );
  }, []);

  const updateItemNotes = useCallback((itemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci))
    );
  }, []);

  const toggleNotesExpand = useCallback((itemId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCashTendered("");
    setGcashConfirmed(false);
    setCustomerName("");
    setExpandedNotes({});
  }, []);

  const handleClearCart = useCallback(async () => {
    if (cart.length === 0) return;
    const ok = await confirm({
      title: "Clear Cart?",
      message: `Remove all ${cartCount} item(s) from the current order?`,
      variant: "warning",
      confirmLabel: "Clear Cart",
    });
    if (ok) clearCart();
  }, [cart.length, cartCount, confirm, clearCart]);

  /* ──────────────────────────────────────────────
     Shift Handlers
     ────────────────────────────────────────────── */

  const handleStartShift = useCallback(
    async (float: number) => {
      try {
        const token = localStorage.getItem("eat-n-repeat-staff-token");
        const res = await fetch(`${getApiUrl()}/api/cash/shift/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ startingFloat: float }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Shift started with ₱${float.toFixed(2)} float`);
          setShiftModalOpen(false);
          fetchActiveCashShift();
        } else {
          toast.error(data.message || "Failed to start shift");
        }
      } catch (e) {
        toast.error("Network error starting shift");
      }
    },
    [fetchActiveCashShift]
  );

  const handleEndShift = useCallback(
    async (actualCash: number) => {
      try {
        const token = localStorage.getItem("eat-n-repeat-staff-token");
        const res = await fetch(`${getApiUrl()}/api/cash/shift/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shiftId: activeCashShift?.id,
            actualCash,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Shift ended successfully");
          setEndShiftModalOpen(false);
          fetchActiveCashShift();
        } else {
          toast.error(data.message || "Failed to end shift");
        }
      } catch (e) {
        toast.error("Network error ending shift");
      }
    },
    [activeCashShift, fetchActiveCashShift]
  );

  /* ──────────────────────────────────────────────
     Payment & Order Completion
     ────────────────────────────────────────────── */

  const handleQuickTender = useCallback(
    (amount: number | "exact") => {
      if (amount === "exact") {
        setCashTendered(total.toFixed(2));
      } else {
        setCashTendered(amount.toString());
      }
    },
    [total]
  );

  const handleCompleteOrder = useCallback(async () => {
    if (!isPaymentValid || isProcessing) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem("eat-n-repeat-staff-token");
      const orderDetails = {
        customerName: customerName.trim() || "Walk-in Customer",
        items: cart.map((ci) => ({
          menuItemId: ci.item.id,
          name: ci.item.name,
          price: ci.item.price,
          quantity: ci.qty,
          notes: ci.notes || undefined,
        })),
        subtotal,
        notes: orderType === "delivery" ? "Delivery order" : orderType.toUpperCase(),
        type: orderType,
      };

      const paymentPayload: Record<string, unknown> = {
        orderDetails,
        paymentMethod,
        orderMode: isLocalMode ? "local" : "online",
      };

      if (paymentMethod === "cash") {
        paymentPayload.cashReceived = tenderedNum;
      }

      const res = await fetch(`${getApiUrl()}/api/payments/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(paymentPayload),
        // Fail fast instead of freezing on a dead route.
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();

      // Handle 503 ONLINE_ORDERING_UNAVAILABLE for online orders
      if (res.status === 503 && data.error === "ONLINE_ORDERING_UNAVAILABLE") {
        toast.error("Online Ordering Temporarily Unavailable \u2014 Eat n\u2019 RepEat Caf\u00e9 is currently unable to receive online orders. Please try again later or visit the caf\u00e9.", { duration: 8000 });
        return;
      }

      if (data.success || data.orderId) {
        const orderNum = data.orderNumber || data.orderId;

        // Only add to local store if the order actually succeeded
        addStoreOrder({
          orderId: orderNum,
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          items: cart
            .map((ci) => `${ci.item.name} (${ci.qty}x)`)
            .join(", "),
          total,
          status: "completed",
          paid: true,
          notes: `${orderType.toUpperCase()} - ${customerName || "Walk-in"}`,
          orderType,
        });

        journalOrder({
          id: orderNum,
          time: new Date().toISOString(),
          items: cart.map((ci) => `${ci.item.name} (${ci.qty}x)`).join(", "),
          total,
          status: "completed",
          paid: true,
          notes: "pos",
        });

        // Show receipt toast
        toast.success(
          (t) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold text-stone-900">Order #{orderNum}</span>
              </div>
              <p className="text-xs text-stone-600">
                Total: ₱{total.toFixed(2)} • {paymentMethod === "cash" ? "Cash" : "GCash"}
              </p>
              {paymentMethod === "cash" && change > 0 && (
                <p className="text-xs text-emerald-700 font-semibold">
                  Change: ₱{change.toFixed(2)}
                </p>
              )}
            </div>
          ),
          { duration: 4000 }
        );

        // Reset
        clearCart();
        setCashTendered("");
        setGcashConfirmed(false);
        setCustomerName("");
        fetchActiveCashShift();
      } else {
        toast.error(data.message || "Failed to process order");
      }
    } catch (e) {
      toast.error("Network error processing order");
    } finally {
      setIsProcessing(false);
    }
  }, [
    isPaymentValid,
    isProcessing,
    cart,
    customerName,
    orderType,
    paymentMethod,
    subtotal,
    total,
    tenderedNum,
    change,
    addStoreOrder,
    clearCart,
    fetchActiveCashShift,
  ]);

  // Auto-focus cash input when payment section appears
  useEffect(() => {
    if (paymentMethod === "cash" && cart.length > 0) {
      const timer = setTimeout(() => cashInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [paymentMethod, cart.length]);

  /* ──────────────────────────────────────────────
     No Shift Screen
     ────────────────────────────────────────────── */

  if (!activeCashShift) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          {isLocalMode && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Local Mode — Cash Only</span>
            </div>
          )}
          <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-5 shadow-sm">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            No Active Shift
          </h2>
          <p className="text-sm text-stone-500 max-w-md mb-6">
            You need to start a cash shift before processing any transactions. Declare your starting drawer float to begin.
          </p>
          <button
            onClick={() => setShiftModalOpen(true)}
            className="px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Start Shift
          </button>
        </div>
        <StartShiftModal
          open={shiftModalOpen}
          onStart={handleStartShift}
        />
      </>
    );
  }

  /* ──────────────────────────────────────────────
     Main POS Layout
     ────────────────────────────────────────────── */

  return (
    <>
      <div className="space-y-4">
        {/* ═══════════════════════════════════════════
            1. SHIFT HEADER
           ═══════════════════════════════════════════ */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Shift status + stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Shift Active
              </span>
              {isLocalMode && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Cash Only
                </span>
              )}
              <div className="hidden sm:flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-semibold">Float:</span>
                  <span className="font-bold text-stone-800">
                    ₱{shiftFloat.toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-4 bg-stone-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-semibold">Cash Sales:</span>
                  <span className="font-bold text-emerald-700">
                    ₱{shiftCashSales.toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-4 bg-stone-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-semibold">Expected:</span>
                  <span className="font-bold text-[#63131d]">
                    ₱{shiftExpected.toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-4 bg-stone-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-semibold">Staff:</span>
                  <span className="font-bold text-stone-800">
                    {activeCashShift.staff_name || user?.name}
                  </span>
                </div>
              </div>
            </div>

            {/* End shift button */}
            <button
              onClick={() => setEndShiftModalOpen(true)}
              className="px-5 py-2.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
            >
              <Clock className="w-3.5 h-3.5" />
              End Shift
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            2. MAIN GRID — Menu (Left) + Cart (Right)
           ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* ─── LEFT: Menu Grid (7 cols) ─── */}
          <div className="lg:col-span-7 space-y-3">
            {/* Toolbar: Search + Category Pills */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/30 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills — horizontal scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    categoryFilter === "all"
                      ? "bg-[#63131d] text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  All Items
                </button>
                {activeCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      categoryFilter === cat.id
                        ? "bg-[#63131d] text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {filteredMenuItems.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-white/60 rounded-3xl border border-stone-200/60">
                  <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-stone-600">
                    No items found
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Try clearing your search or category filter.
                  </p>
                </div>
              ) : (
                filteredMenuItems.map((item) => {
                  const inCart = cart.find((ci) => ci.item.id === item.id);
                  const hasImgError = failedImages[item.id];
                  const catName = getMenuCategoryName(item.categoryId);

                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`group relative rounded-2xl border bg-white p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-md active:scale-[0.97] text-left cursor-pointer ${
                        inCart
                          ? "border-[#63131d]/40 ring-1 ring-[#63131d]/20 bg-stone-50/30"
                          : "border-stone-200/80 hover:border-[#63131d]/30"
                      }`}
                    >
                      {/* Image */}
                      <div className="relative w-full h-24 rounded-xl overflow-hidden bg-stone-100 mb-2.5 border border-stone-200/50 shrink-0">
                        {item.image && !hasImgError ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={() =>
                              setFailedImages((p) => ({ ...p, [item.id]: true }))
                            }
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#63131d]/10 via-amber-50 to-stone-100 text-[#63131d]">
                            <UtensilsCrossed className="w-6 h-6 text-[#63131d]/50 mb-1" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#63131d]/60">
                              Café
                            </span>
                          </div>
                        )}

                        {/* Cart badge */}
                        {inCart && (
                          <span className="absolute top-2 right-2 flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-[#63131d] text-white font-black text-xs shadow-md animate-in zoom-in-50 duration-150">
                            {inCart.qty}
                          </span>
                        )}
                      </div>

                      {/* Name & Category */}
                      <h4 className="font-bold text-stone-900 text-xs leading-snug line-clamp-2 min-h-[32px]">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-stone-400 font-semibold mt-0.5 truncate">
                        {catName}
                      </p>

                      {/* Price & Add */}
                      <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="font-black text-[#63131d] text-sm tracking-wide">
                          ₱{item.price.toFixed(2)}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                            inCart
                              ? "bg-[#63131d] text-white shadow-xs"
                              : "bg-stone-100 text-stone-700 group-hover:bg-[#63131d] group-hover:text-white"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" /> ADD
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── RIGHT: Cart & Payment Panel (5 cols) ─── */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm space-y-4 sticky top-6">

              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#63131d]">
                    Current Order
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200/60">
                  {cartCount} {cartCount === 1 ? "item" : "items"}
                </span>
              </div>

              {/* ─── Order Type Selector ─── */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Order Type
                </label>
                <div className={`grid gap-1.5 bg-stone-100 rounded-xl p-1 ${isLocalMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {[
                    { type: "dine-in" as OrderType, icon: UtensilsCrossed, label: "Dine-in" },
                    { type: "takeout" as OrderType, icon: ShoppingBag, label: "Takeout" },
                    ...(!isLocalMode ? [{ type: "delivery" as OrderType, icon: Truck, label: "Delivery" }] : []),
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`py-2 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        orderType === type
                          ? "bg-white text-[#63131d] shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Customer Name ─── */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Customer Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Optional — for tracking"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3 text-xs font-semibold text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#63131d]/20 transition-all"
                  />
                </div>
              </div>

              {/* ─── Cart Items List ─── */}
              <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-stone-400 space-y-2">
                    <ShoppingBag className="w-10 h-10 text-stone-200 mx-auto" />
                    <p className="text-sm font-semibold text-stone-500">
                      No items yet
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-[180px] mx-auto">
                      Tap menu items on the left to add them here.
                    </p>
                  </div>
                ) : (
                  cart.map((ci) => (
                    <div
                      key={ci.item.id}
                      className="rounded-xl bg-stone-50/70 border border-stone-200/60 p-3 space-y-2"
                    >
                      {/* Row: name, qty, total, remove */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-stone-900 text-xs truncate">
                            {ci.item.name}
                          </p>
                          <p className="text-[10px] text-stone-500 font-semibold">
                            ₱{ci.item.price.toFixed(2)} each
                          </p>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-stone-200 px-0.5 py-0.5 shadow-xs">
                          <button
                            onClick={() => updateQty(ci.item.id, ci.qty - 1)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 font-bold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-black text-stone-900 text-xs">
                            {ci.qty}
                          </span>
                          <button
                            onClick={() => updateQty(ci.item.id, ci.qty + 1)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line total & remove */}
                        <div className="text-right shrink-0 flex items-center gap-1.5">
                          <span className="font-black text-[#63131d] text-xs">
                            ₱{(ci.item.price * ci.qty).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeFromCart(ci.item.id)}
                            className="text-stone-400 hover:text-red-500 p-0.5 cursor-pointer transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Special instructions toggle */}
                      <div>
                        <button
                          onClick={() => toggleNotesExpand(ci.item.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#63131d] hover:underline cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          {ci.notes ? "Edit note" : "Add note"}
                          {ci.notes && (
                            <span className="text-stone-400 font-normal">
                              ({ci.notes.length > 20 ? ci.notes.slice(0, 20) + "..." : ci.notes})
                            </span>
                          )}
                          {expandedNotes[ci.item.id] ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        {expandedNotes[ci.item.id] && (
                          <input
                            type="text"
                            placeholder="e.g. Less ice, no sugar..."
                            value={ci.notes}
                            onChange={(e) => updateItemNotes(ci.item.id, e.target.value)}
                            className="w-full mt-1.5 rounded-lg border border-stone-200 bg-white py-1.5 px-2.5 text-[11px] text-stone-800 outline-none focus:ring-1 focus:ring-[#63131d]/20 transition-all"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ─── Price Summary ─── */}
              <div className="pt-3 border-t border-stone-200/80 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Tax</span>
                  <span>₱0.00</span>
                </div>
                <div className="flex justify-between items-center text-base font-black text-[#63131d] pt-2 border-t border-dashed border-stone-200">
                  <span>TOTAL</span>
                  <span className="text-xl font-black">₱{total.toFixed(2)}</span>
                </div>
              </div>

              {/* ─── Payment Method ─── */}
              <div className="space-y-3 pt-2 border-t border-stone-200/80">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("cash");
                      setGcashConfirmed(false);
                    }}
                    className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === "cash"
                        ? "bg-[#63131d] text-white shadow-sm"
                        : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60"
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> Cash
                  </button>
                  {!isLocalMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("gcash");
                        setCashTendered("");
                      }}
                      disabled={isOffline}
                      title={isOffline ? "GCash is unavailable offline" : ""}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        isOffline
                          ? "opacity-40 cursor-not-allowed bg-stone-100 border border-stone-200 text-stone-400"
                          : paymentMethod === "gcash"
                          ? "bg-[#63131d] text-white shadow-sm cursor-pointer"
                          : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" /> GCash
                      {isOffline && " (Offline)"}
                    </button>
                  )}
                </div>

                {/* Cash Payment Controls */}
                {paymentMethod === "cash" && (
                  <div className="space-y-2.5 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-1">
                        Cash Tendered (₱)
                      </label>
                      <input
                        ref={cashInputRef}
                        type="number"
                        min={0}
                        step="0.01"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-stone-300 bg-white py-2.5 px-3 text-sm font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/40 transition-all text-center"
                      />
                    </div>

                    {/* Quick Tender Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickTender("exact")}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer transition-colors"
                      >
                        Exact ₱{total.toFixed(0)}
                      </button>
                      {[100, 200, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickTender(amt)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-700 hover:bg-stone-200 cursor-pointer transition-colors"
                        >
                          ₱{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* Change Display */}
                    {cashTendered && (
                      <div
                        className={`p-3 rounded-xl text-center font-bold text-xs border transition-all ${
                          change >= 0
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {change >= 0 ? (
                          <div className="flex items-center justify-between px-1">
                            <span className="text-emerald-700">Change Due:</span>
                            <span className="text-base font-black text-emerald-800">
                              ₱{change.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span>
                            Insufficient amount — ₱{Math.abs(change).toFixed(2)} short
                          </span>
                        )}
                      </div>
                    )}

                    {/* Denomination Breakdown */}
                    {cashTendered && change > 0 && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Change Breakdown
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {breakdownChange(change).map((d) => (
                            <span
                              key={d.label}
                              className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700 shadow-xs"
                            >
                              <span className="text-[#63131d] font-bold">{d.count}×</span>{" "}
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* GCash Payment Controls */}
                {paymentMethod === "gcash" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-blue-800 text-sm">GCash Payment</span>
                      </div>
                      <p className="text-2xl font-black text-blue-900">
                        ₱{total.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-blue-600">
                        Collect payment from customer and confirm below.
                      </p>
                      <button
                        type="button"
                        onClick={() => setGcashConfirmed(!gcashConfirmed)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          gcashConfirmed
                            ? "bg-emerald-600 text-white"
                            : "bg-white border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        {gcashConfirmed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            GCash Payment Confirmed
                          </>
                        ) : (
                          <>
                            <CircleDollarSign className="w-4 h-4" />
                            Mark as Paid
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Action Buttons ─── */}
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={handleCompleteOrder}
                  disabled={!isPaymentValid || isProcessing}
                  className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Order — ₱{total.toFixed(2)}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cart.length === 0}
                  className="w-full py-2.5 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-500 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════ */}
      <StartShiftModal open={shiftModalOpen} onStart={handleStartShift} />
      <EndShiftModal
        open={endShiftModalOpen}
        shift={activeCashShift}
        onEnd={handleEndShift}
        onClose={() => setEndShiftModalOpen(false)}
      />
    </>
  );
}
