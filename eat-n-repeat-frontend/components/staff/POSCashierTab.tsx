"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useNetworkStatus } from "@/context/NetworkStatusContext";
import { useIsLocalBackend } from "@/lib/config";
import { StartShiftModal, EndShiftModal } from "@/components/staff/CashModals";
import { ExpenseModal, type DrawerExpenseResult } from "@/components/staff/ExpenseModal";
import { staffCard } from "@/components/staff/StaffPanel";
import toast from "react-hot-toast";
import type { ExpenseItem, MenuItem } from "@/lib/admin/types";
import { expenseRowsNet, isExpenseReversal } from "@/lib/admin/expense-utils";
import { getApiUrl } from "@/lib/config";
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";
import { parse2 } from "@/lib/customer/promo-format";
import { formatPhTime } from "@/lib/admin/delivery-utils";
import { POSReceiptModal } from "@/components/staff/POSReceiptModal";
import type { POSReceiptDialogMode } from "@/components/staff/POSReceiptModal";
import type {
  CheckoutResponse,
  POSReceipt,
  PosSaleRow,
  PosSalesSummary,
} from "@/components/staff/pos-receipt-types";
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
  Receipt,
  RefreshCw,
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

/** Right-panel tabs: the live order form vs. today's completed sales. */
type PosPanelTab = "current" | "paid";

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
    createShiftExpense,
    addStoreOrder,
    getMenuCategoryName,
  } = useAdminData();
  const { confirm } = useConfirm();
  const { isOffline } = useNetworkStatus();
  const isLocalMode = useIsLocalBackend();

  // ─── Shift State ───
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [endShiftModalOpen, setEndShiftModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  // Offline shift override: while the device is offline, shift start/close
  // journal ops and this optimistic value stands in for the server row.
  // Cleared on successful drain (server becomes source of truth again).
  const [offlineShiftOverride, setOfflineShiftOverride] = useState<null | { cleared: true } | Record<string, any>>(null);
  const activeShift = offlineShiftOverride === null
    ? activeCashShift
    : (offlineShiftOverride as any).cleared === true
      ? null
      : (offlineShiftOverride as Record<string, any>);

  useEffect(() => {
    const onSynced = () => {
      setOfflineShiftOverride(null);
      fetchActiveCashShift();
    };
    window.addEventListener("eat-n-repeat:offline-synced", onSynced);
    return () => window.removeEventListener("eat-n-repeat:offline-synced", onSynced);
  }, [fetchActiveCashShift]);

  // Authenticated staff identity for offline journals (AuthContext session
  // first, staff JWT subject as fallback — never a manual entry).
  const getStaffIdentity = useCallback((): { id: string; name: string } | null => {
    if (user?.id) return { id: user.id, name: user?.name || "Staff" };
    try {
      const token = getStaffOrAdminToken();
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
        if (typeof payload?.sub === "string") {
          return { id: payload.sub, name: typeof payload?.name === "string" ? payload.name : "Staff" };
        }
      }
    } catch { /* token unreadable */ }
    return null;
  }, [user]);

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

  // ─── Right Panel Tabs & Receipt State ───
  const [activeTab, setActiveTab] = useState<PosPanelTab>("current");
  const [receipt, setReceipt] = useState<POSReceipt | null>(null);
  // Which dialog is showing: "receipt" = post-checkout confirmation;
  // "details" = reopened from Paid Today (no cart side effects).
  const [receiptDialogMode, setReceiptDialogMode] =
    useState<POSReceiptDialogMode>("receipt");

  // ─── Promo State (counter sales) ───
  // Same contract as the customer cart: only the raw code is validated
  // (channel "pos", anonymous walk-in) and only the code is sent at
  // checkout — the server computes every peso of the discount.
  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoAppliedCode, setPromoAppliedCode] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<string | null>(null); // "30.00"
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // ─── Paid Today State ───
  const [posSales, setPosSales] = useState<PosSaleRow[]>([]);
  const [posSalesSummary, setPosSalesSummary] = useState<PosSalesSummary | null>(null);
  const [posSalesLoading, setPosSalesLoading] = useState(false);
  const [posSalesError, setPosSalesError] = useState<string | null>(null);

  // ─── Image Fallback ───
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // ─── Refs ───
  const cashInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Synchronous double-submit guard: two clicks in the same tick both see
  // isProcessing === false, so a ref (checked + set in the same synchronous
  // pass) is the only reliable lock. Held until the receipt modal closes.
  const checkoutInFlightRef = useRef(false);
  // Monotonic id per Paid Today fetch: only the newest request may touch
  // sales state, so slow/stale responses can never overwrite fresh data
  // or flash a stale error.
  const posSalesRequestIdRef = useRef(0);

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
  // Server-quoted promo discount (clamped by the server at checkout).
  const promoDiscountAmount = Math.min(
    promoPreview != null ? parse2(promoPreview) : 0,
    subtotal,
  );
  const total = Math.max(0, subtotal + tax - promoDiscountAmount);
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
  const shiftFloat = activeShift ? Number(activeShift.starting_float) : 0;
  const shiftExpected = activeShift ? Number(activeShift.expected_cash) : 0;
  const shiftCashSales = activeShift ? shiftExpected - shiftFloat : 0;
  // Drawer expenses: /shift/current provides the row array; compute the
  // net locally (expense − reversal, voided rows skipped).
  const shiftExpenseRows: ExpenseItem[] =
    activeShift && Array.isArray(activeShift.expenses)
      ? (activeShift.expenses as ExpenseItem[])
      : [];
  const shiftExpensesNet = expenseRowsNet(shiftExpenseRows);

  // Drawer paid-out handler: the ctx helper posts and refetches the active
  // shift; the modal owns validation and the toasts.
  const handleShiftExpense = useCallback(
    async (input: {
      amount: number;
      category: string;
      reason: string;
      note?: string;
    }): Promise<DrawerExpenseResult> => {
      if (!activeShift?.id) {
        return { ok: false, message: "No open shift found.", shift: null };
      }
      const result = await createShiftExpense(String(activeShift.id), input);
      return { ok: result.ok, message: result.message, shift: result.shift };
    },
    [activeShift, createShiftExpense]
  );

  // ─── Force GCash off when offline ───
  useEffect(() => {
    if (isOffline && paymentMethod === "gcash") {
      setPaymentMethod("cash");
      toast.error("GCash is unavailable offline. Switched to cash.");
    }
  }, [isOffline, paymentMethod]);

  /* ──────────────────────────────────────────────
     Promo (counter sales)
     ────────────────────────────────────────────── */

  const clearPromo = useCallback(() => {
    setPromoAppliedCode(null);
    setPromoPreview(null);
    setPromoMessage(null);
    setPromoCode("");
  }, []);

  const applyPromo = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || promoValidating || isOffline) return;
      setPromoValidating(true);
      setPromoMessage(null);
      try {
        const res = await fetch(`${getApiUrl()}/api/promos/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, subtotal, channel: "pos" }),
        });
        const data = await res.json().catch(() => null);
        if (data?.ok) {
          setPromoAppliedCode(String(data.code));
          setPromoPreview(String(data.discount ?? "0.00"));
          setPromoMessage(null);
        } else {
          setPromoAppliedCode(null);
          setPromoPreview(null);
          // Server copy verbatim (incl. the POS walk-in copy).
          setPromoMessage(data?.message ?? "This code isn't valid");
        }
      } catch {
        setPromoAppliedCode(null);
        setPromoPreview(null);
        setPromoMessage("Can't reach the server to check this code.");
      } finally {
        setPromoValidating(false);
      }
    },
    [promoValidating, isOffline, subtotal]
  );

  // Keep the counter quote truthful as the order changes.
  useEffect(() => {
    if (!promoAppliedCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/promos/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: promoAppliedCode, subtotal, channel: "pos" }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.ok) {
          setPromoPreview(String(data.discount ?? "0.00"));
        } else {
          setPromoAppliedCode(null);
          setPromoPreview(null);
          setPromoMessage(data?.message ?? "This code isn't valid");
        }
      } catch {
        if (cancelled) return;
        setPromoAppliedCode(null);
        setPromoPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoAppliedCode, subtotal]);

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
     Paid Today — today's completed POS sales
     ────────────────────────────────────────────── */

  const fetchPosSales = useCallback(async () => {
    const requestId = ++posSalesRequestIdRef.current;
    setPosSalesLoading(true);
    try {
      const token = getStaffOrAdminToken();
      const res = await fetch(`${getApiUrl()}/api/cash/pos-sales/today`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      // Superseded by a newer fetch — ignore this response entirely.
      if (requestId !== posSalesRequestIdRef.current) return;

      if (res.ok) {
        let data: Partial<{
          success: boolean;
          summary: PosSalesSummary;
          sales: PosSaleRow[];
        }> | null = null;
        let parseFailed = false;
        try {
          data = (await res.json()) as Partial<{
            success: boolean;
            summary: PosSalesSummary;
            sales: PosSaleRow[];
          }>;
        } catch {
          parseFailed = true;
        }
        if (requestId !== posSalesRequestIdRef.current) return;

        if (!parseFailed && data?.success) {
          // Success — even a 0-sale day is a success and clears any error.
          setPosSales(Array.isArray(data.sales) ? data.sales : []);
          setPosSalesSummary(data.summary ?? null);
          setPosSalesError(null);
          return;
        }
        // Non-ok body / parse failure: a true failure. The existing list is
        // intentionally left untouched so a stale refresh keeps old data.
        setPosSalesError("Couldn't load today's sales right now.");
      } else {
        setPosSalesError("Couldn't load today's sales right now.");
      }
    } catch {
      // Network/timeout failure — same policy: keep old data, show error
      // only if this request is still the newest one.
      if (requestId === posSalesRequestIdRef.current) {
        setPosSalesError("Couldn't load today's sales. Check your connection.");
      }
    } finally {
      if (requestId === posSalesRequestIdRef.current) {
        setPosSalesLoading(false);
      }
    }
  }, []);

  // Fetch on tab activation; also re-fetched after every successful
  // checkout so the list is fresh without a manual refresh.
  useEffect(() => {
    if (activeTab === "paid") fetchPosSales();
  }, [activeTab, fetchPosSales]);

  // Open the shared receipt dialog in details mode (no cart side effects).
  const handleViewDetails = useCallback((sale: PosSaleRow) => {
    setReceiptDialogMode("details");
    setReceipt(sale);
  }, []);

  // Shared close path: the post-checkout confirmation clears the cart and
  // returns to the Current Order tab; details just close back onto Paid Today.
  const handleReceiptClose = useCallback(() => {
    const wasPostCheckout = receiptDialogMode === "receipt";
    setReceipt(null);
    setReceiptDialogMode("receipt");
    // Release the double-submit guard only now (post-checkout flow).
    checkoutInFlightRef.current = false;
    if (wasPostCheckout) {
      clearCart();
      // The consumed sale should not leak its code into the next order.
      clearPromo();
      setActiveTab("current");
    }
  }, [receiptDialogMode, clearCart, clearPromo]);

  /* ──────────────────────────────────────────────
     Shift Handlers
     ────────────────────────────────────────────── */

  const handleStartShift = useCallback(
    async () => {
      try {
        const token = getStaffOrAdminToken();
        const res = await fetch(`${getApiUrl()}/api/cash/shift/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Shift started with pre-configured float");
          setShiftModalOpen(false);
          setOfflineShiftOverride(null);
          fetchActiveCashShift();
        } else {
          toast.error(data.message || "Failed to start shift");
        }
      } catch (e) {
        // Offline: journal the start with a client-generated id and stand
        // up an optimistic local shift so POS keeps working. The drain
        // creates it server-side (idempotent) and later closes attribute.
        try {
          const identity = getStaffIdentity();
          if (!identity) {
            toast.error("Please sign in as staff to start a shift.");
            return;
          }
          if (activeShift) {
            toast.error("You already have an open shift.");
            return;
          }
          const { journalShiftOp } = await import("@/lib/offlineSync");
          const shiftId = `shift-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;
          journalShiftOp({ shiftId, kind: "start", staffId: identity.id, startingFloat: 0 });
          setOfflineShiftOverride({
            id: shiftId,
            staff_id: identity.id,
            staff_name: identity.name,
            starting_float: 0, // Will be set from server config
            expected_cash: 0,
            cash_sales: 0,
            gcash_sales: 0,
            status: "open",
            start_time: new Date().toISOString(),
          });
          setShiftModalOpen(false);
          toast.success("Shift started offline — will sync when reconnected.");
        } catch {
          toast.error("Network error starting shift");
        }
      }
    },
    [fetchActiveCashShift, activeShift, getStaffIdentity]
  );

  const handleEndShift = useCallback(
    async (actualCash: number, notes?: string) => {
      try {
        const token = getStaffOrAdminToken();
        const res = await fetch(`${getApiUrl()}/api/cash/shift/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shiftId: activeShift?.id,
            actualCash,
            ...(notes?.trim() ? { notes: notes.trim() } : {}),
          }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Shift ended successfully");
          setEndShiftModalOpen(false);
          setOfflineShiftOverride(null);
          fetchActiveCashShift();
        } else {
          toast.error(data.message || "Failed to end shift");
        }
      } catch (e) {
        // Offline: journal the close against the (possibly offline-created)
        // shift id; the drain applies it last with server-side variance.
        try {
          if (!activeShift) {
            toast.error("No active shift to close.");
            return;
          }
          const identity = getStaffIdentity();
          const { journalShiftOp } = await import("@/lib/offlineSync");
          journalShiftOp({
            shiftId: String(activeShift.id),
            kind: "close",
            staffId: identity?.id ?? "",
            actualCash,
            notes: notes?.trim() || null,
          });
          setOfflineShiftOverride({ cleared: true });
          setEndShiftModalOpen(false);
          toast.success("Shift closed offline — will sync when reconnected.");
        } catch {
          toast.error("Network error ending shift");
        }
      }
    },
    [activeShift, fetchActiveCashShift, getStaffIdentity]
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
    // Synchronous double-click guard: a rapid second click lands in the
    // same tick before isProcessing re-renders, so only a ref can stop
    // the second request. Held until the receipt modal closes.
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;

    setIsProcessing(true);
    // Client-generated number, sent with the payload AND reused for any
    // offline journal entry: the server honors staff-provided numbers and
    // returns the existing order on retry, so a timeout can never mint a
    // duplicate sale.
    const posOrderNumber = `POS-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;
    // When the receipt modal opens, the guard stays held until it closes;
    // every other exit path releases it in `finally` below.
    let keepLockForReceipt = false;
    try {
      const token = getStaffOrAdminToken();
      const orderDetails = {
        orderNumber: posOrderNumber,
        customerName: customerName.trim() || "Walk-in Customer",
        items: cart.map((ci) => ({
          menuItemId: ci.item.id,
          name: ci.item.name,
          price: ci.item.price,
          quantity: ci.qty,
          notes: ci.notes || undefined,
        })),
        subtotal,
        // Promo: the raw code string only. The server resolves it against
        // pos channel rules (anonymous walk-in) and computes the discount.
        ...(promoAppliedCode ? { promoCode: promoAppliedCode } : {}),
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

      // Belt and suspenders with AbortSignal: an explicit race guarantees
      // this await settles even if the network stack stalls the abort
      // (e.g. throttled background tab), so the button can never stick.
      const CHECKOUT_TIMEOUT_MS = 25000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const res = await Promise.race([
        fetch(`${getApiUrl()}/api/payments/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(paymentPayload),
          // Fail fast instead of freezing on a dead route.
          signal: AbortSignal.timeout(15000),
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            const err: any = new Error("Checkout timed out. Please check the orders list before retrying.");
            err.name = "TimeoutError";
            reject(err);
          }, CHECKOUT_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

      const data = (await res.json()) as CheckoutResponse;

      // Handle 503 ONLINE_ORDERING_UNAVAILABLE for online orders
      if (res.status === 503 && data.error === "ONLINE_ORDERING_UNAVAILABLE") {
        toast.error("Online Ordering Temporarily Unavailable \u2014 Eat n\u2019 RepEat Caf\u00e9 is currently unable to receive online orders. Please try again later or visit the caf\u00e9.", { duration: 8000 });
        return;
      }

      if (data.success || data.orderId) {
        const orderNum = String(data.orderNumber || data.orderId || "");

        // Only add to local store if the order actually succeeded
        addStoreOrder({
          orderId: orderNum,
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          // ISO stamp for reliable newest-first sorting (display uses `time`).
          orderedAt: new Date().toISOString(),
          items: cart
            .map((ci) => `${ci.item.name} (${ci.qty}x)`)
            .join(", "),
          total,
          status: "completed",
          paid: true,
          notes: `${orderType.toUpperCase()} - ${customerName || "Walk-in"}`,
          orderType,
        });

        // NOTE: no journalOrder here — the server just accepted this order.
        // Journaling a successful POS sale would queue it for offline replay
        // and insert a second (customer-less) row with the same order number.
        // Network-failure cash sales ARE journaled in the catch below.

        const serverReceipt = data.receipt ?? null;
        if (serverReceipt) {
          // Receipt modal replaces the success toast. The cart is kept
          // until the receipt closes, then cleared + back to Current Order.
          setReceiptDialogMode("receipt");
          setReceipt(serverReceipt);
          keepLockForReceipt = true;
          // Refresh Paid Today in the background so the list is already
          // fresh whenever the cashier switches tabs.
          fetchPosSales();
        } else {
          // Unexpected: no receipt in the response — legacy fallback
          // (success toast + immediate clear), never an empty modal.
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
          clearPromo();
          setCashTendered("");
          setGcashConfirmed(false);
          setCustomerName("");
          fetchPosSales();
        }
        fetchActiveCashShift();
      } else {
        toast.error(data.message || "Failed to process order");
      }
    } catch (e: any) {
      // Offline cash sales are captured locally and replayed by the sync
      // drain (INSERT IGNORE + order-number guard => no duplicates).
      // GCash is never journaled: an online payment that failed cannot be
      // assumed collected. Non-network errors keep the old behavior.
      // TimeoutError counts as a network failure: the server may still have
      // saved the order, but the journal reuses posOrderNumber so the drain
      // guard (and the server's own duplicate-return) converge to one row.
      const msg = typeof e?.message === 'string' ? e.message : '';
      const offlineBrowser =
        typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
      const isNetworkFailure =
        offlineBrowser ||
        e instanceof TypeError ||
        e?.name === 'TimeoutError' ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        msg.includes('timed out');
      if (isNetworkFailure && paymentMethod === 'cash') {
        try {
          const { journalOrder, journalPayment } = await import('@/lib/offlineSync');
          const offlineId = posOrderNumber;
          const itemsSummary = cart
            .map((ci) => `${ci.item.name} (${ci.qty}x)`)
            .join(", ");
          // Offline sales keep NO promo: codes can only be validated by the
          // café server, so the replayed total is the plain (undiscounted)
          // amount and the code is cleared with the cart.
          const offlineTotal = Math.max(0, subtotal + tax);
          journalOrder({
            id: offlineId,
            time: new Date().toISOString(),
            items: itemsSummary,
            total: offlineTotal,
            status: 'completed',
            paid: true,
            notes: `${orderType.toUpperCase()} - ${customerName || "Walk-in"}`,
            address: null,
            customerNotes: null,
            // Preserve fulfillment type so the replayed row keeps it
            // (dine-in/pickup/delivery) instead of defaulting to dine-in.
            type: orderType,
          });
          // Queue the collection too so the drain records the PAID payment
          // and attributes the drawer (originating staff first).
          try {
            const staffToken = getStaffOrAdminToken();
            let staffId: string | null = null;
            if (user?.id) staffId = user.id;
            else if (staffToken) {
              try {
                const payload = JSON.parse(atob(staffToken.split(".")[1] ?? ""));
                if (typeof payload?.sub === "string") staffId = payload.sub;
              } catch { /* token unreadable — drain falls back to operator */ }
            }
            journalPayment({ orderId: offlineId, method: 'Cash', cashReceived: tenderedNum, staffId });
          } catch { /* payment queue is best-effort; the order journal stands */ }
          addStoreOrder({
            orderId: offlineId,
            time: new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            orderedAt: new Date().toISOString(),
            items: itemsSummary,
            total: offlineTotal,
            status: "completed",
            paid: true,
            notes: `${orderType.toUpperCase()} - ${customerName || "Walk-in"}`,
            orderType,
          });
          // Keep the offline X-read honest: this drawer cash is real, so
          // the optimistic shift total grows with it until the drain lands.
          setOfflineShiftOverride((prev) =>
            prev && !(prev as any).cleared
              ? { ...(prev as Record<string, any>), expected_cash: Number((prev as any).expected_cash || 0) + offlineTotal }
              : prev
          );
        } catch {
          // Journaling must never break the sale.
        }
        toast.success("Saved offline — will sync when reconnected.", { duration: 4000 });
        clearCart();
        clearPromo();
        setCashTendered("");
        setGcashConfirmed(false);
        setCustomerName("");
      } else {
        toast.error("Network error processing order");
      }
    } finally {
      // Release the double-submit guard unless the receipt modal took
      // over the lock — that is released when the receipt closes.
      if (!keepLockForReceipt) checkoutInFlightRef.current = false;
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
    promoAppliedCode,
    addStoreOrder,
    clearCart,
    clearPromo,
    fetchActiveCashShift,
    fetchPosSales,
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

  if (!activeShift) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
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
          onClose={() => setShiftModalOpen(false)}
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
        <div className={staffCard}>
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Shift status + stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Shift Active
              </span>
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
                  <span className="text-stone-400 font-semibold">Expenses:</span>
                  <span className="font-bold text-stone-700">
                    ₱{shiftExpensesNet.toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-4 bg-stone-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400 font-semibold">Staff:</span>
                  <span className="font-bold text-stone-800">
                    {activeShift.staff_name || user?.name}
                  </span>
                </div>
              </div>
            </div>

            {/* End shift + expense controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpenseModalOpen(true)}
                disabled={isOffline}
                title={isOffline ? "Expenses need a connection." : "Record a drawer paid-out"}
                className="px-4 py-2.5 bg-white border border-stone-200 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Banknote className="w-3.5 h-3.5" />
                Add Expense
              </button>
              <button
                onClick={() => setEndShiftModalOpen(true)}
                className="px-5 py-2.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <Clock className="w-3.5 h-3.5" />
                End Shift
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            2. MAIN GRID — Menu (Left) + Cart (Right)
           ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* ─── LEFT: Menu Grid (7 cols) ─── */}
          <div className="lg:col-span-7 space-y-3">
            {/* Toolbar: Search + Category Pills */}
            <div className={`${staffCard} p-4 space-y-3`}>
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
            <div className={`${staffCard} p-5 space-y-4 sticky top-6`}>

              {/* Panel Header — Tabs (switching never mutates the cart) */}
              <div className="flex items-center border-b border-stone-100 pb-3">
                <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 w-full">
                  <button
                    type="button"
                    onClick={() => setActiveTab("current")}
                    className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "current"
                        ? "bg-white text-[#63131d] shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Current Order</span>
                    <span
                      className={`shrink-0 h-5 min-w-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                        activeTab === "current"
                          ? "bg-[#63131d] text-white"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {cartCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("paid")}
                    className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "paid"
                        ? "bg-white text-[#63131d] shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Paid Today</span>
                  </button>
                </div>
              </div>

              {activeTab === "current" ? (
              <>
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

              {/* ─── Promo (counter) ─── */}
              {cart.length > 0 && (
                <div className="pt-2 space-y-1.5 border-t border-stone-200/80">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Promo Code
                  </label>
                  {promoAppliedCode ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                      <p className="text-[11px] font-black text-emerald-700">
                        ✓ {promoAppliedCode}
                        {promoDiscountAmount > 0 ? (
                          <span className="font-semibold"> — saves ₱{promoDiscountAmount.toFixed(2)}</span>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        onClick={clearPromo}
                        className="text-[10px] font-bold text-stone-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Enter code"
                        value={promoCode}
                        disabled={isOffline}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyPromo(promoCode);
                          }
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-stone-300 bg-white py-2 px-2.5 text-[11px] font-mono uppercase text-stone-800 outline-none focus:ring-1 focus:ring-[#63131d]/20 transition-all disabled:bg-stone-100 disabled:text-stone-400"
                      />
                      <button
                        type="button"
                        onClick={() => applyPromo(promoCode)}
                        disabled={promoValidating || isOffline || !promoCode.trim()}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0 ${
                          promoValidating || isOffline || !promoCode.trim()
                            ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                            : "bg-[#63131d] text-white hover:bg-[#7d1c29]"
                        }`}
                      >
                        {promoValidating ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoMessage && (
                    <p className="text-[10px] font-semibold text-rose-600">{promoMessage}</p>
                  )}
                  {isOffline && !promoAppliedCode && (
                    <p className="text-[10px] text-stone-400">
                      Promo codes need the café server — unavailable offline.
                    </p>
                  )}
                </div>
              )}

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
                {promoAppliedCode && promoDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount · {promoAppliedCode}</span>
                    <span>-₱{promoDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
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
                            <Banknote className="w-4 h-4" />
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
              </>
              ) : (
                <PaidTodayPanel
                  sales={posSales}
                  summary={posSalesSummary}
                  loading={posSalesLoading}
                  error={posSalesError}
                  onRefresh={fetchPosSales}
                  onViewDetails={handleViewDetails}
                  shiftExpenses={shiftExpenseRows}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════ */}
      <StartShiftModal
        open={shiftModalOpen}
        onStart={handleStartShift}
        onClose={() => setShiftModalOpen(false)}
      />
      <EndShiftModal
        open={endShiftModalOpen}
        shift={activeShift}
        onEnd={handleEndShift}
        onClose={() => setEndShiftModalOpen(false)}
      />
      <ExpenseModal
        open={expenseModalOpen}
        shift={activeShift}
        onSubmit={handleShiftExpense}
        onClose={() => setExpenseModalOpen(false)}
      />
      <POSReceiptModal
        open={receipt !== null}
        receipt={receipt}
        mode={receiptDialogMode}
        onClose={handleReceiptClose}
      />
    </>
  );
}

/* ──────────────────────────────────────────────
   Paid Today Panel (right panel, 5/12 width)
   ────────────────────────────────────────────── */

type PaidTodayPanelProps = {
  sales: PosSaleRow[];
  summary: PosSalesSummary | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onViewDetails: (sale: PosSaleRow) => void;
  /** Drawer expense rows for the active shift (server refetches on write). */
  shiftExpenses?: ExpenseItem[];
};

/** ₱ amount with PH thousands separators: 1,234.50 */
function phpAmount(value: unknown): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function paymentChipClass(method: string | undefined): string {
  const m = (method || "").toLowerCase();
  if (m.includes("gcash")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (m.includes("cash")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-stone-100 text-stone-600 border-stone-200";
}

function PaidTodayPanel({
  sales,
  summary,
  loading,
  error,
  onRefresh,
  onViewDetails,
  shiftExpenses = [],
}: PaidTodayPanelProps) {
  const count = summary ? Number(summary.count) || 0 : sales.length;
  const collected = summary ? Number(summary.totalCollected) || 0 : 0;
  const expenseNet = expenseRowsNet(shiftExpenses);

  return (
    <div className="space-y-3">
      {/* ─── Summary card ─── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#63131d] via-[#63131d] to-[#4a0e16] p-4 text-white shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
            Shift Sales
          </p>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh today's sales"
            aria-label="Refresh today's sales"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-black leading-none">{count}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mt-1">
              {count === 1 ? "Sale" : "Sales"} Today
            </p>
          </div>
          <div className="text-right min-w-0">
            <p className="text-lg font-black leading-none text-emerald-300 truncate">
              ₱{phpAmount(collected)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mt-1">
              Total Collected
            </p>
          </div>
        </div>
      </div>

      {/* ─── Shift Expenses (drawer paid-outs this shift) ─── */}
      <div className="rounded-xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            Shift Expenses
          </p>
          <p className={`text-xs font-black ${expenseNet < 0 ? "text-emerald-700" : "text-[#63131d]"}`}>
            ₱{phpAmount(Math.abs(expenseNet))}{expenseNet < 0 ? " net" : ""}
          </p>
        </div>
        {shiftExpenses.length === 0 ? (
          <p className="px-3.5 py-3 text-[11px] font-semibold text-stone-400">
            No expenses paid out this shift.
          </p>
        ) : (
          <div className="max-h-[168px] overflow-y-auto divide-y divide-stone-100">
            {shiftExpenses.map((row) => {
              const reversal = isExpenseReversal(row);
              const voided = row.status === "voided";
              return (
                <div key={row.id} className="px-3.5 py-2 flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-stone-400 shrink-0">
                    {formatPhTime(row.createdAt) || "—"}
                  </span>
                  <span
                    className="shrink-0 inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-600"
                    title={voided ? row.voidReason || "Voided" : undefined}
                  >
                    {voided ? "Voided · " : ""}{row.category || "—"}
                  </span>
                  <p className="flex-1 min-w-0 text-[11px] font-semibold text-stone-700 truncate">
                    {row.reason || "—"}
                  </p>
                  <span
                    className={`shrink-0 text-[11px] font-black ${
                      voided
                        ? "text-stone-400 line-through"
                        : reversal
                          ? "text-emerald-700"
                          : "text-stone-900"
                    }`}
                  >
                    {voided
                      ? `₱${phpAmount(row.amount)}`
                      : reversal
                        ? `+₱${phpAmount(row.amount)} back`
                        : `₱${phpAmount(row.amount)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Sales list ─── */}
      <div className="max-h-[calc(100vh-360px)] min-h-[160px] overflow-y-auto space-y-2 pr-1">
        {loading && sales.length === 0 ? (
          /* Compact skeleton */
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-stone-50/70 border border-stone-200/60 p-3 space-y-2 animate-pulse"
            >
              <div className="flex justify-between gap-2">
                <div className="h-3 w-28 bg-stone-200 rounded" />
                <div className="h-3 w-14 bg-stone-200 rounded" />
              </div>
              <div className="h-2.5 w-full bg-stone-200/70 rounded" />
              <div className="h-2.5 w-1/2 bg-stone-200/70 rounded" />
            </div>
          ))
        ) : error && sales.length === 0 ? (
          /* Friendly inline retry (list still empty) */
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2.5">
            <Receipt className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-xs font-bold text-amber-800">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3.5 py-1.5 rounded-xl bg-[#63131d] hover:bg-[#7d1c29] text-white text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        ) : sales.length === 0 ? (
          /* Empty state */
          <div className="py-10 text-center text-stone-400 space-y-2">
            <Receipt className="w-10 h-10 text-stone-200 mx-auto" />
            <p className="text-sm font-semibold text-stone-500">
              No sales yet today
            </p>
            <p className="text-[11px] text-stone-400 max-w-[200px] mx-auto">
              Completed orders will appear here right after checkout.
            </p>
          </div>
        ) : (
          <>
            {/* Stale-refresh failure: keep data visible, offer a quiet retry */}
            {error && (
              <button
                type="button"
                onClick={onRefresh}
                className="w-full text-left px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh failed — tap to retry
              </button>
            )}
            {sales.map((sale, idx) => (
              <div
                key={`${sale.orderNumber}-${idx}`}
                className="rounded-xl bg-stone-50/70 border border-stone-200/60 p-3 space-y-1.5"
              >
                {/* Row head: time + order number + total */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-black text-stone-400 shrink-0">
                      {formatPhTime(sale.createdAt) || "—"}
                    </span>
                    <span className="text-xs font-bold text-stone-900 truncate">
                      #{sale.orderNumber}
                    </span>
                  </div>
                  <span className="font-black text-[#63131d] text-xs shrink-0">
                    ₱{phpAmount(sale.total)}
                  </span>
                </div>

                {/* Items summary */}
                <p className="text-[10px] text-stone-500 font-semibold truncate">
                  {sale.itemsSummary || "—"}
                </p>

                {/* Payment info + details */}
                <div className="flex items-end justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${paymentChipClass(sale.paymentMethod)}`}
                    >
                      {sale.paymentMethod || "—"}
                    </span>
                    {sale.promoCode && (
                      <span
                        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700"
                      >
                        {sale.promoCode}
                        {Number(sale.discount) > 0 ? ` −₱${phpAmount(sale.discount)}` : ""}
                      </span>
                    )}
                    {sale.cashTendered !== null && sale.cashTendered !== undefined && (
                      <span className="text-[10px] text-stone-400 font-semibold">
                        Tendered ₱{phpAmount(sale.cashTendered)}
                      </span>
                    )}
                    {sale.change !== null && sale.change !== undefined && (
                      <span className="text-[10px] text-emerald-700 font-bold">
                        Change ₱{phpAmount(sale.change)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewDetails(sale)}
                    title="View sale details"
                    className="shrink-0 px-2 py-1 rounded-lg bg-white border border-stone-200 text-[10px] font-bold text-[#63131d] hover:border-[#63131d]/40 hover:bg-stone-50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Receipt className="w-3 h-3" />
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
