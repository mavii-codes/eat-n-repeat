"use client";

import { useState, useMemo } from "react";
import type { MenuItem, MenuCategory, StockItem, StockItemInput } from "@/lib/admin/types";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  RotateCcw,
  ShoppingBag,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  Sparkles,
  FileText,
  X,
  Store,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ── Change Denomination Calculation Helper ── */
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

type POSCartItem = {
  item: MenuItem;
  qty: number;
  selectedSize?: { name: string; price: number };
};

type ReceiptData = {
  cart: POSCartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "Cash" | "GCash";
  tendered: number;
  change: number;
  gcashRefNo?: string;
  breakdown: { label: string; count: number }[];
  receiptNo: string;
  orderType: "dine-in" | "takeout";
  tableNumber?: string;
  orderNote?: string;
  date: string;
  time: string;
  cashier: string;
};

type POSCashierTabProps = {
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  getMenuCategoryName: (id: string) => string;
  addStoreOrder: (order: any) => void;
  stockItems?: StockItem[];
  updateStockItem?: (id: string, input: StockItemInput) => void;
  staffName: string;
};

import { useNetworkStatus } from "@/context/NetworkStatusContext";

export function POSCashierTab({
  menuItems,
  menuCategories,
  getMenuCategoryName,
  addStoreOrder,
  stockItems = [],
  updateStockItem,
  staffName,
}: POSCashierTabProps) {
  const { isOffline } = useNetworkStatus();
  
  // Search & Filter State
  const [sizeSelectorItem, setSizeSelectorItem] = useState<MenuItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Cart & Order Options State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [orderType, setOrderType] = useState<"dine-in" | "takeout">("dine-in");
  const [tableNumber, setTableNumber] = useState("Table 01");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [orderNote, setOrderNote] = useState("");

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "GCash">("Cash");
  const [tendered, setTendered] = useState("");
  const [gcashRefNo, setGcashRefNo] = useState("");

  // UI Processing & Receipt Modal State
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Image load error tracking for fallback icons
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Active Category Options
  const categoriesList = useMemo(() => {
    return menuCategories.filter((c) => !c.archived);
  }, [menuCategories]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.archived || !item.available) return false;
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (
        searchTerm &&
        !item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !getMenuCategoryName(item.categoryId).toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [menuItems, categoryFilter, searchTerm, getMenuCategoryName]);

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.selectedSize ? ci.selectedSize.price : ci.item.price) * ci.qty, 0);
  }, [cart]);

  const taxRate = 0; // standard cafe pricing
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + tax;

  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - total;

  // Cart Handlers
  function handleItemClick(item: MenuItem) {
    if (item.sizes && item.sizes.filter(s => s.available).length > 0) {
      setSizeSelectorItem(item);
    } else {
      addToCart(item);
    }
  }

  function addToCart(item: MenuItem, selectedSize?: { name: string; price: number }) {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id && ci.selectedSize?.name === selectedSize?.name);
      if (existing) {
        return prev.map((ci) => (ci.item.id === item.id && ci.selectedSize?.name === selectedSize?.name ? { ...ci, qty: ci.qty + 1 } : ci));
      }
      return [...prev, { item, qty: 1, selectedSize }];
    });
    setSizeSelectorItem(null);
  }

  function removeFromCart(itemId: string, sizeName?: string) {
    setCart((prev) => prev.filter((ci) => !(ci.item.id === itemId && ci.selectedSize?.name === sizeName)));
  }

  function updateQty(itemId: string, sizeName: string | undefined, qty: number) {
    if (qty <= 0) {
      removeFromCart(itemId, sizeName);
      return;
    }
    setCart((prev) => prev.map((ci) => ((ci.item.id === itemId && ci.selectedSize?.name === sizeName) ? { ...ci, qty } : ci)));
  }

  function clearCart() {
    setCart([]);
    setTendered("");
    setGcashRefNo("");
    setOrderNote("");
    setShowNoteInput(false);
  }

  // Quick Bill Shortcuts for Cash
  function applyTenderShortcut(amount: number | "exact") {
    if (amount === "exact") {
      setTendered(total.toString());
    } else {
      setTendered(amount.toString());
    }
  }

  // Quick Note Pills
  function addNoteSuggestion(suggestion: string) {
    setOrderNote((prev) => (prev ? `${prev}, ${suggestion}` : suggestion));
  }

  // Validate Transaction Completion
  const isPaymentValid = useMemo(() => {
    if (cart.length === 0) return false;
    if (paymentMethod === "Cash") {
      return tenderedNum >= total && tendered.trim() !== "";
    }
    if (paymentMethod === "GCash") {
      return gcashRefNo.trim().length >= 4;
    }
    return false;
  }, [cart, paymentMethod, tenderedNum, total, tendered, gcashRefNo]);

  // Complete Transaction Handler
  async function handleCompleteTransaction() {
    if (!isPaymentValid || isProcessing) return;

    setIsProcessing(true);
    const now = new Date();
    const shortId = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${shortId}`;

    // Add to Store Orders in Admin Context (Dashboard & History)
    addStoreOrder({
      orderId: `POS-${shortId}`,
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      items: cart
        .map((ci) => `${ci.item.name} (${ci.qty}x)`)
        .concat(orderType === "dine-in" ? [`[Dine-in: ${tableNumber}]`] : ["[Takeout]"])
        .join(", "),
      total,
      status: "completed",
      paid: true,
      notes: orderNote ? `${orderType.toUpperCase()} - ${orderNote}` : orderType.toUpperCase(),
    });

    // Optional Inventory Ingredient Deduction Connection
    if (updateStockItem && stockItems.length > 0) {
      cart.forEach((cartItem) => {
        const matchingStock = stockItems.find((s) =>
          s.name.toLowerCase().includes(cartItem.item.name.toLowerCase()) ||
          cartItem.item.name.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchingStock) {
          const newQty = Math.max(0, matchingStock.quantity - cartItem.qty);
          updateStockItem(matchingStock.id, {
            name: matchingStock.name,
            categoryId: matchingStock.categoryId,
            quantity: newQty,
            unit: matchingStock.unit,
            lowStockThreshold: matchingStock.lowStockThreshold,
          });
        }
      });
    }

    // Set Receipt Data & Open Receipt Confirmation Modal
    setReceiptData({
      cart: [...cart],
      subtotal,
      tax,
      total,
      paymentMethod,
      tendered: paymentMethod === "Cash" ? tenderedNum : total,
      change: paymentMethod === "Cash" ? Math.max(0, change) : 0,
      gcashRefNo: paymentMethod === "GCash" ? gcashRefNo.trim() : undefined,
      breakdown: paymentMethod === "Cash" ? breakdownChange(Math.max(0, change)) : [],
      receiptNo,
      orderType,
      tableNumber: orderType === "dine-in" ? tableNumber : undefined,
      orderNote: orderNote.trim() || undefined,
      date: now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      cashier: staffName || "Staff Cashier",
    });

    setIsProcessing(false);
    setReceiptOpen(true);
  }

  // Reset for New Walk-in Transaction
  function handleNewTransaction() {
    clearCart();
    setReceiptOpen(false);
    setReceiptData(null);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#63131d]/10 px-2.5 py-0.5 text-xs font-bold text-[#63131d] border border-[#63131d]/20 uppercase tracking-wider">
              <Store className="w-3 h-3" /> Walk-in Sales
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#63131d] mt-1.5">
            POS Cashier
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Process dine-in and takeout transactions quickly for in-store customers.
          </p>
        </div>
      </div>

      {/* ── MAIN LAYOUT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT SECTION: MENU ITEM PICKER (7 COLS ON LG) ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* TOOLBAR: SEARCH & CATEGORY PILLS */}
          <div className="rounded-2xl border border-stone-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2.5 pl-10 pr-3 text-xs font-semibold text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/30 transition-all"
                />
              </div>

              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-48 rounded-xl border border-stone-200 bg-stone-50/50 py-2.5 px-3 text-xs font-bold text-stone-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#63131d]/20 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                  categoryFilter === "all"
                    ? "bg-[#63131d] text-white shadow-2xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                }`}
              >
                All Items
              </button>
              {categoriesList.map((cat) => {
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#63131d] text-white shadow-2xs"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MENU ITEMS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredMenuItems.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white/60 rounded-3xl border border-stone-200/60">
                <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-stone-600">No menu items found</p>
                <p className="text-xs text-stone-400 mt-1">
                  Try clearing your search or category filter.
                </p>
              </div>
            ) : (
              filteredMenuItems.map((item) => {
                const inCart = cart.find((ci) => ci.item.id === item.id);
                const categoryName = getMenuCategoryName(item.categoryId);
                const hasImageError = failedImages[item.id];

                return (
                  <div
                    key={item.id}
                    className={`group relative rounded-2xl border bg-white p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-[#63131d]/30 ${
                      inCart
                        ? "border-[#63131d]/40 ring-1 ring-[#63131d]/20 bg-stone-50/30"
                        : "border-stone-200/80"
                    }`}
                  >
                    <div>
                      {/* Product Image with Fallback Placeholder */}
                      <div className="relative w-full h-24 rounded-xl overflow-hidden bg-stone-100 mb-2.5 border border-stone-200/50 shrink-0">
                        {item.image && !hasImageError ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#63131d]/10 via-amber-50 to-stone-100 text-[#63131d]">
                            <UtensilsCrossed className="w-6 h-6 text-[#63131d]/60 mb-1" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#63131d]/70">
                              Café Fresh
                            </span>
                          </div>
                        )}

                        {/* Cart Badge Count */}
                        {inCart && (
                          <span className="absolute top-2 right-2 flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-[#63131d] text-white font-black text-xs shadow-md animate-in zoom-in-50 duration-150">
                            {inCart.qty}
                          </span>
                        )}
                      </div>

                      {/* Title (2 lines max) & Category */}
                      <h4 className="font-bold text-stone-900 text-xs leading-snug line-clamp-2 min-h-[32px]">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-stone-400 font-semibold mt-0.5 truncate">
                        {categoryName}
                      </p>
                    </div>

                    {/* Price & ADD + Button */}
                    <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="font-black text-[#63131d] text-sm tracking-wide">
                        ₱{item.price.toFixed(2)}
                      </span>

                      <button
                        onClick={() => handleItemClick(item)}
                        className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                          inCart
                            ? "bg-[#63131d] text-white shadow-2xs hover:bg-[#500f17]"
                            : "bg-stone-100 text-stone-700 hover:bg-[#63131d] hover:text-white"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT SECTION: CURRENT TRANSACTION PANEL (5 COLS ON LG) ── */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-md space-y-4 sticky top-6">
            {/* PANEL HEADER */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Walk-in Order #POS-1025
                </span>
                <h3 className="font-serif text-xl font-bold text-[#63131d]">Current Transaction</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200/60">
                {cart.reduce((sum, ci) => sum + ci.qty, 0)} Items
              </span>
            </div>

            {/* CART ITEMS LIST */}
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-stone-400 space-y-2">
                  <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs font-semibold text-stone-600">Cart is currently empty</p>
                  <p className="text-[11px] text-stone-400">
                    Tap menu items on the left to add them to this transaction.
                  </p>
                </div>
              ) : (
                cart.map((ci) => (
                  <div
                    key={ci.item.id}
                    className="p-3 rounded-2xl bg-stone-50/70 border border-stone-200/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-900 truncate">{ci.item.name}</p>
                      <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                        ₱{ci.item.price.toFixed(2)} each
                      </p>
                    </div>

                    {/* Touch-friendly Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-white rounded-xl border border-stone-200 px-1 py-0.5 shadow-2xs">
                      <button
                        onClick={() => updateQty(ci.item.id, ci.selectedSize?.name, ci.qty - 1)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 font-bold transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-black text-stone-900 text-xs">
                        {ci.qty}
                      </span>
                      <button
                        onClick={() => updateQty(ci.item.id, ci.selectedSize?.name, ci.qty + 1)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Row Total & Remove */}
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="font-black text-[#63131d] text-xs">
                        ₱{(ci.item.price * ci.qty).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(ci.item.id, ci.selectedSize?.name)}
                        className="text-stone-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

              {/* ORDER TYPE TOGGLE (Dine-in vs Takeout) */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("dine-in")}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      orderType === "dine-in"
                        ? "bg-[#63131d] text-white shadow-2xs"
                        : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60"
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Dine-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("takeout")}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      orderType === "takeout"
                        ? "bg-[#63131d] text-white shadow-2xs"
                        : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Takeout
                  </button>
                </div>
              </div>

            {/* COLLAPSIBLE ORDER NOTES */}
            <div className="space-y-1 pt-1">
              <button
                type="button"
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="flex items-center justify-between w-full text-[11px] font-bold text-[#63131d] hover:underline cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Add Order Note {orderNote && "(1 active)"}
                </span>
                {showNoteInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showNoteInput && (
                <div className="space-y-2 pt-1.5 animate-in fade-in duration-150">
                  <input
                    type="text"
                    placeholder="e.g. Less ice, No sugar, Extra sauce..."
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white py-2 px-3 text-xs text-stone-800 outline-none focus:ring-2 focus:ring-[#63131d]/20"
                  />
                  {/* Quick Note Pills */}
                  <div className="flex flex-wrap gap-1">
                    {["Less ice", "No sugar", "Extra sauce", "No onions", "Takeout bag"].map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => addNoteSuggestion(note)}
                        className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold hover:bg-stone-200 cursor-pointer"
                      >
                        + {note}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PRICE SUMMARY */}
            <div className="pt-3 border-t border-stone-200/80 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Discount / Tax</span>
                <span>-₱0.00</span>
              </div>
              <div className="flex justify-between items-center text-base font-black text-[#63131d] pt-2 border-t border-dashed border-stone-200">
                <span>TOTAL</span>
                <span className="text-xl font-black">₱{total.toFixed(2)}</span>
              </div>
            </div>

            {/* PAYMENT METHOD SECTION */}
            <div className="space-y-3 pt-2 border-t border-stone-200/80">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Cash")}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "Cash"
                      ? "bg-[#63131d] text-white shadow-2xs"
                      : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("GCash")}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "GCash"
                      ? "bg-[#63131d] text-white shadow-2xs"
                      : "bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200/60"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> GCash
                </button>
              </div>

              {/* CASH PAYMENT CONTROLS */}
              {paymentMethod === "Cash" && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 mb-1">
                      Amount Tendered (₱)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                      placeholder="Enter cash given..."
                      className="w-full rounded-xl border border-stone-300 bg-white py-2.5 px-3 text-sm font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/40 transition-all"
                    />
                  </div>

                  {/* Quick Tender Bill Shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyTenderShortcut("exact")}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-700 hover:bg-stone-200 cursor-pointer"
                    >
                      Exact (₱{total.toFixed(0)})
                    </button>
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => applyTenderShortcut(amt)}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-700 hover:bg-stone-200 cursor-pointer"
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation Box */}
                  {tendered && (
                    <div
                      className={`p-3 rounded-2xl text-center font-bold text-xs border ${
                        change >= 0
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {change >= 0 ? (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-emerald-700">Change:</span>
                          <span className="text-base font-black text-emerald-800">
                            ₱{change.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span>Insufficient amount (₱{Math.abs(change).toFixed(2)} short)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GCASH REFERENCE CONTROLS */}
              {paymentMethod === "GCash" && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="block text-[10px] font-bold text-stone-500">
                    GCash Reference Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 13-digit GCash Ref #..."
                    value={gcashRefNo}
                    onChange={(e) => setGcashRefNo(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white py-2.5 px-3 text-xs font-bold text-stone-900 outline-none focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/40 transition-all"
                  />
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="py-3 px-4 rounded-2xl border border-stone-200 bg-white text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Clear Cart
              </button>
              <button
                type="button"
                onClick={handleCompleteTransaction}
                disabled={!isPaymentValid || isProcessing}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#63131d] text-white font-bold text-xs shadow-md hover:bg-[#500f17] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Complete Transaction
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RECEIPT CONFIRMATION MODAL ── */}
      {receiptOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="flex flex-col items-center max-w-[320px] w-full space-y-4 my-auto">
            {/* THERMAL PAPER RECEIPT CARD */}
            <div className="w-full bg-[#fdfdfd] text-[#1c1c1c] font-mono text-xs shadow-2xl rounded-sm p-6 space-y-3 border border-stone-200 select-text">
              {/* HEADER */}
              <div className="text-center space-y-1">
                <p className="font-bold text-sm tracking-widest text-stone-900">*** RECEIPT ***</p>
                <div className="text-[11px] text-stone-700 space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span>CASHIER:</span>
                    <span>{receiptData.cashier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE:</span>
                    <span>{receiptData.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TIME:</span>
                    <span>{receiptData.time}</span>
                  </div>
                </div>
              </div>

              {/* DOTTED SEPARATOR */}
              <div className="border-b border-dotted border-stone-400 my-2" />

              {/* ORDER TYPE */}
              <div className="text-[11px] font-bold text-stone-800 space-y-0.5">
                <div className="flex justify-between">
                  <span>ORDER TYPE:</span>
                  <span>{receiptData.orderType.toUpperCase()}</span>
                </div>
              </div>

              {/* DOTTED SEPARATOR */}
              <div className="border-b border-dotted border-stone-400 my-2" />

              {/* ITEMS HEADER & LIST */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold text-stone-900 border-b border-dotted border-stone-300 pb-1">
                  <span>ITEM</span>
                  <span>AMOUNT</span>
                </div>
                {receiptData.cart.map((ci) => (
                  <div key={ci.item.id} className="flex justify-between items-start text-stone-800">
                    <span className="pr-2">
                      {ci.item.name} {ci.qty > 1 ? `x${ci.qty}` : "x1"}
                    </span>
                    <span className="shrink-0 font-bold">
                      ₱{(ci.item.price * ci.qty).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* DOTTED SEPARATOR */}
              <div className="border-b border-dotted border-stone-400 my-2" />

              {/* PAYMENT SUMMARY */}
              <div className="space-y-1 text-[11px] text-stone-800">
                <div className="flex justify-between">
                  <span>SUBTOTAL</span>
                  <span>₱{receiptData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DISCOUNT</span>
                  <span>₱0.00</span>
                </div>

                <div className="border-b border-dotted border-stone-400 my-1" />

                <div className="flex justify-between font-bold text-stone-900 text-xs py-0.5">
                  <span>TOTAL</span>
                  <span>₱{receiptData.total.toFixed(2)}</span>
                </div>

                <div className="pt-1.5 space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>PAYMENT:</span>
                    <span>{receiptData.paymentMethod.toUpperCase()}</span>
                  </div>
                  {receiptData.paymentMethod === "Cash" ? (
                    <>
                      <div className="flex justify-between">
                        <span>CASH</span>
                        <span>₱{receiptData.tendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>CHANGE</span>
                        <span>₱{receiptData.change.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>REFERENCE:</span>
                        <span>{receiptData.gcashRefNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AMOUNT</span>
                        <span>₱{receiptData.total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* DOTTED SEPARATOR */}
              <div className="border-b border-dotted border-stone-400 my-2" />

              {/* FOOTER */}
              <div className="text-center space-y-1 pt-1">
                <p className="font-bold text-xs text-stone-800">THANK YOU!</p>
                <p className="text-[10px] text-stone-500 pt-0.5">Receipt #: {receiptData.receiptNo}</p>
              </div>
            </div>

            {/* ACTION BUTTONS BELOW RECEIPT */}
            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                type="button"
                onClick={handleNewTransaction}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#63131d] text-white text-xs font-bold hover:bg-[#500f17] flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
