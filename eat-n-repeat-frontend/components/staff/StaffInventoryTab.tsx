"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  BarChart2,
  CheckCircle2,
  XCircle,
  X,
  MessageSquare,
  Clock,
  Package,
  AlertTriangle,
  Send,
} from "lucide-react";
import type { StockItem } from "@/lib/admin/types";
import { useAdminData } from "@/context/AdminDataContext";
import { useAuth } from "@/context/AuthContext";
import { AdminPanel } from "@/components/admin/AdminForm";
import { getPendingStockTransactions } from "@/lib/offlineSync";

/* ── Types ──────────────────────────────────────── */
type Toast = {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info";
};

/* ── Props ──────────────────────────────────────── */
type StaffInventoryTabProps = {
  stockItems: StockItem[];
  stockCategories: { id: string; name: string }[];
  getStockCategoryName: (id: string) => string;
  addStockItem?: any;
  updateStockItem?: any;
  deleteStockItem?: any;
  staffName: string;
};

/* ── Component ──────────────────────────────────── */
export function StaffInventoryTab({
  stockItems,
  stockCategories,
  getStockCategoryName,
  staffName,
}: StaffInventoryTabProps) {
  const { user } = useAuth();
  const { stockRequests, addStockRequest } = useAdminData();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Toast Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Pending Offline Syncs
  const [pendingSyncItemIds, setPendingSyncItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    async function checkPendingSync() {
      try {
        const txs = await getPendingStockTransactions();
        if (mounted) {
          const ids = new Set(txs.map((tx: any) => tx.stockItemId));
          setPendingSyncItemIds(ids);
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    checkPendingSync();
    
    // Listen for online to refresh when synced
    const handleOnline = () => {
      setTimeout(checkPendingSync, 2000); // give it time to sync
    };
    window.addEventListener('online', handleOnline);
    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  /* ── Toast Helper ────────────────── */
  function showToast(title: string, message: string, type: "success" | "error" | "info" = "success") {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  /* ── Monitor Admin Request Status Changes for Toast Notifications ── */
  const prevRequestsRef = useRef<typeof stockRequests>([]);
  useEffect(() => {
    if (prevRequestsRef.current.length > 0 && stockRequests) {
      stockRequests.forEach((req) => {
        const prev = prevRequestsRef.current.find((p) => p.id === req.id);
        if (prev && prev.status === "Pending" && req.status !== "Pending") {
          if (req.status === "Approved") {
            showToast(
              "Restock request approved",
              `Admin approved restock for ${req.ingredientName}.`,
              "success"
            );
          } else if (req.status === "Rejected") {
            showToast(
              "Restock request rejected",
              `Admin rejected request for ${req.ingredientName}${req.adminNote ? `: ${req.adminNote}` : ""}.`,
              "error"
            );
          }
        }
      });
    }
    prevRequestsRef.current = stockRequests || [];
  }, [stockRequests]);

  /* ── KPI Calculations ────────────────── */
  const { totalItems, lowStock, outOfStock, optimalStock } = useMemo(() => {
    let low = 0;
    let out = 0;
    let optimal = 0;

    stockItems.forEach((item) => {
      if (item.quantity <= 0) out++;
      else if (item.quantity <= item.lowStockThreshold) low++;
      else optimal++;
    });

    return {
      totalItems: stockItems.length,
      lowStock: low,
      outOfStock: out,
      optimalStock: optimal,
    };
  }, [stockItems]);

  /* ── Alert Items ────────────────── */
  const alertItems = useMemo(() => {
    return stockItems.filter((item) => item.quantity <= item.lowStockThreshold);
  }, [stockItems]);

  /* ── Staff Previous Requests ────────────────── */
  const myRequests = useMemo(() => {
    return [...(stockRequests || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stockRequests]);

  /* ── Filtered Items for Table ────────────────── */
  const getItemStatus = (item: StockItem) => {
    if (item.quantity === 0) return "out-of-stock";
    if (item.quantity <= item.lowStockThreshold) return "low-stock";
    return "optimal";
  };

  const filteredItems = useMemo(() => {
    let items = [...stockItems];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          getStockCategoryName(i.categoryId).toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "all") {
      items = items.filter(
        (i) =>
          i.categoryId === selectedCategory ||
          getStockCategoryName(i.categoryId).toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    return items;
  }, [stockItems, search, selectedCategory, getStockCategoryName]);

  /* ── Contact Admin / Restock Request Handler ── */
  function handleContactAdmin(item: StockItem) {
    const existingPending = (stockRequests || []).find(
      (r) => r.ingredientId === item.id && r.status === "Pending"
    );

    if (existingPending) {
      showToast(
        "Request Pending",
        `A restock request for ${item.name} is already pending Admin review.`,
        "info"
      );
      return;
    }

    addStockRequest({
      staffId: user?.id || "sf-1",
      staffName: staffName || user?.name || "Staff",
      ingredientId: item.id,
      ingredientName: item.name,
      currentQuantity: item.quantity,
      unit: item.unit,
      threshold: item.lowStockThreshold,
      message: `Restock request for ${item.name}`,
    });

    showToast(
      "Restock request sent",
      `The Admin has been notified about ${item.name}.`,
      "success"
    );
  }

  /* ── RENDER ──────────────────── */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#63131d] border border-[#63131d]/10">
            Inventory
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#63131d] mt-1.5">
            Stock Levels
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Monitor ingredient levels and request restocking when needed.
          </p>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#63131d]/5 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <Package className="w-5 h-5 text-[#63131d]" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">
              Total Items
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#63131d] mt-0.5 sm:mt-1">
              {totalItems}
            </p>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
              Optimal
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 sm:mt-1">
              {optimalStock}
            </p>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800">
              Low Stock
            </p>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5 sm:mt-1">
              {lowStock}
            </p>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-red-200 shadow-sm flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mb-2 sm:mb-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-red-800">
              Out of Stock
            </p>
            <p className="text-xl sm:text-2xl font-black text-red-700 mt-0.5 sm:mt-1">
              {outOfStock}
            </p>
          </div>
        </div>
      </div>

      {/* ALERTS & REQUEST HISTORY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* STOCK ALERTS PANEL */}
        <div className="lg:col-span-2">
          <AdminPanel title="Stock Alerts" subtitle="Ingredients requiring attention">
            <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 bg-white/40 backdrop-blur-md">
              {alertItems.length === 0 ? (
                <div className="col-span-full py-6 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">
                    All stock levels are healthy.
                  </p>
                </div>
              ) : (
                alertItems.map((item) => {
                  const isOut = item.quantity <= 0;
                  const request = [...(stockRequests || [])]
                    .filter((r) => r.ingredientId === item.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                  const isPending = request?.status === "Pending";

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border ${
                        isOut
                          ? "bg-red-50/60 border-red-200"
                          : "bg-amber-50/60 border-amber-200"
                      } flex flex-col justify-between gap-3 shadow-2xs`}
                    >
                      <div className="flex gap-3 items-start">
                        <AlertTriangle
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            isOut ? "text-red-500" : "text-amber-500"
                          }`}
                        />
                        <div>
                          <h4
                            className={`font-bold text-sm ${
                              isOut ? "text-red-900" : "text-amber-900"
                            }`}
                          >
                            {item.name}
                          </h4>
                          <p
                            className={`text-xs mt-1 font-semibold ${
                              isOut ? "text-red-700" : "text-amber-800"
                            }`}
                          >
                            {item.quantity} {item.unit} remaining
                          </p>
                          <p
                            className={`text-[10px] mt-0.5 uppercase tracking-wider font-bold ${
                              isOut ? "text-red-500" : "text-amber-600"
                            }`}
                          >
                            Threshold: {item.lowStockThreshold} {item.unit}
                          </p>
                        </div>
                      </div>

                      {isPending ? (
                        <button
                          onClick={() => handleContactAdmin(item)}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-amber-200 bg-amber-100/90 text-amber-800 font-bold text-xs hover:bg-amber-200/80 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Request Pending
                        </button>
                      ) : (
                        <button
                          onClick={() => handleContactAdmin(item)}
                          className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-colors shadow-2xs cursor-pointer ${
                            isOut
                              ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                              : "bg-[#63131d] hover:bg-[#500f17] text-white shadow-[#63131d]/20"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Contact Admin
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </AdminPanel>
        </div>

        {/* RESTOCK REQUESTS HISTORY */}
        <div className="lg:col-span-1 h-fit">
          <AdminPanel title="Restock Requests" subtitle="Your previous requests">
            <div className="p-4 bg-white/40 backdrop-blur-md max-h-[260px] overflow-y-auto space-y-3">
              {myRequests.length === 0 ? (
                <div className="py-6 text-center text-stone-400 text-xs font-semibold">
                  No restock requests found.
                </div>
              ) : (
                myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-start gap-3"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                        req.status === "Approved"
                          ? "bg-emerald-500"
                          : req.status === "Rejected"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-800 text-sm truncate">
                        {req.ingredientName}
                      </h4>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-stone-500 font-semibold">
                          {req.currentQuantity} {req.unit || "units"} remaining
                        </p>
                        <p className="text-[10px] font-bold text-stone-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {req.adminNote && (
                        <p className="text-[10px] text-stone-600 mt-1 bg-stone-50 p-1.5 rounded-lg border border-stone-200/60">
                          <span className="font-semibold text-stone-700">Note:</span> {req.adminNote}
                        </p>
                      )}
                      <span
                        className={`inline-flex mt-2 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          req.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : req.status === "Rejected"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </AdminPanel>
        </div>
      </div>

      {/* MAIN INVENTORY LEDGER CARD */}
      <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#63131d]">
            Inventory Ledger
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time stock quantities linked to order processing
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-800 placeholder-stone-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/30 transition-all"
          />
        </div>

        {/* CATEGORY FILTER PILLS */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "all"
                ? "bg-[#5c141d] text-white shadow-sm"
                : "bg-white border border-stone-200 text-stone-600 hover:border-[#63131d]/30 hover:bg-stone-50"
            }`}
          >
            All Items
          </button>
          {stockCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id || selectedCategory === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#5c141d] text-white shadow-sm"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-[#63131d]/30 hover:bg-stone-50"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* INVENTORY TABLE — Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-[11px] font-bold tracking-wider text-stone-400 uppercase py-3">
                <th className="pb-4 font-bold">INGREDIENT</th>
                <th className="pb-4 font-bold">CATEGORY</th>
                <th className="pb-4 font-bold">REMAINING QUANTITY</th>
                <th className="pb-4 font-bold">STATUS</th>
                <th className="pb-4 font-bold">ALERT THRESHOLD</th>
                <th className="pb-4 font-bold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Filter className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-sm">No inventory items found</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Try adjusting your search or category filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const status = getItemStatus(item);
                  const isLow = status === "low-stock" || status === "out-of-stock";
                  const categoryName = getStockCategoryName(item.categoryId);

                  const request = [...(stockRequests || [])]
                    .filter((r) => r.ingredientId === item.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                  let progressPercent = 100;
                  if (item.lowStockThreshold > 0) {
                    const ratio = item.quantity / item.lowStockThreshold;
                    if (isLow) {
                      progressPercent = Math.min(100, Math.max(12, ratio * 50));
                    } else {
                      progressPercent = Math.min(
                        100,
                        Math.max(30, (item.quantity / (item.lowStockThreshold * 2.5)) * 100)
                      );
                    }
                  }

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                      {/* INGREDIENT */}
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-400 shrink-0">
                            <BarChart2 className="w-4 h-4 text-stone-400" />
                          </div>
                          <span className="font-bold text-[#5c141d] text-base">{item.name}</span>
                        </div>
                      </td>

                      {/* CATEGORY */}
                      <td className="py-4 pr-4">
                        <span className="inline-flex bg-stone-100/90 border border-stone-200/60 text-stone-600 px-3.5 py-1 rounded-full text-xs font-semibold">
                          {categoryName}
                        </span>
                      </td>

                      {/* REMAINING QUANTITY */}
                      <td className="py-4 pr-4">
                        <div className="flex flex-col justify-center min-w-[130px]">
                          <span className="font-black text-stone-900 text-sm tracking-wide uppercase">
                            {item.quantity} {item.unit}
                          </span>
                          {pendingSyncItemIds.has(item.id) && (
                            <span className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Sync
                            </span>
                          )}
                          <div className="w-28 sm:w-36 h-2 bg-stone-200/70 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isLow ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="py-4 pr-4">
                        {status === "low-stock" || status === "out-of-stock" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-amber-50/90 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> LOW STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-50/90 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> OPTIMAL
                          </span>
                        )}
                      </td>

                      {/* ALERT THRESHOLD */}
                      <td className="py-4 pr-4">
                        <span className="text-xs font-bold text-stone-500">
                          {item.lowStockThreshold} {item.unit}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {request?.status === "Pending" ? (
                            <button
                              onClick={() => handleContactAdmin(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100/80 transition-colors shadow-2xs cursor-pointer"
                              title="Click to check request status"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Request Pending
                            </button>
                          ) : request?.status === "Approved" ? (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                            </span>
                          ) : request?.status === "Rejected" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs shadow-2xs">
                                <XCircle className="w-3.5 h-3.5 text-red-600" /> Rejected
                              </span>
                              {isLow && (
                                <button
                                  onClick={() => handleContactAdmin(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs hover:bg-stone-50 hover:border-[#63131d]/30 transition-colors shadow-2xs cursor-pointer"
                                >
                                  Contact Admin
                                </button>
                              )}
                            </div>
                          ) : isLow ? (
                            <button
                              onClick={() => handleContactAdmin(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs hover:bg-stone-50 hover:border-[#63131d]/30 transition-colors shadow-2xs cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400" /> Contact Admin
                            </button>
                          ) : (
                            <span className="text-stone-300 font-bold px-3">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* INVENTORY CARDS — Mobile View */}
        <div className="md:hidden space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Filter className="h-8 w-8 mx-auto mb-2 text-stone-300" />
              <p className="font-semibold text-sm">No inventory items found</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const status = getItemStatus(item);
              const isLow = status === "low-stock" || status === "out-of-stock";
              const categoryName = getStockCategoryName(item.categoryId);

              const request = [...(stockRequests || [])]
                .filter((r) => r.ingredientId === item.id)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

              let progressPercent = 100;
              if (item.lowStockThreshold > 0) {
                const ratio = item.quantity / item.lowStockThreshold;
                if (isLow) {
                  progressPercent = Math.min(100, Math.max(12, ratio * 50));
                } else {
                  progressPercent = Math.min(
                    100,
                    Math.max(30, (item.quantity / (item.lowStockThreshold * 2.5)) * 100)
                  );
                }
              }

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-400 shrink-0">
                        <BarChart2 className="w-4 h-4 text-stone-400" />
                      </div>
                      <div>
                        <p className="font-bold text-[#5c141d] text-base">{item.name}</p>
                        <span className="inline-flex bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full text-[10px] font-semibold mt-0.5">
                          {categoryName}
                        </span>
                      </div>
                    </div>
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        • LOW STOCK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        • OPTIMAL
                      </span>
                    )}
                  </div>

                  {/* Quantity & Progress */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-stone-500">Remaining</span>
                      <div className="flex flex-col items-end">
                        <span className="text-stone-900 uppercase">
                          {item.quantity} {item.unit}
                        </span>
                        {pendingSyncItemIds.has(item.id) && (
                          <span className="text-[9px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Sync
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 text-right">
                      Threshold: {item.lowStockThreshold} {item.unit}
                    </p>
                  </div>

                  {/* Restock Request status on Mobile */}
                  {isLow && (
                    <div className="pt-1">
                      {request?.status === "Pending" ? (
                        <button
                          onClick={() => handleContactAdmin(item)}
                          className="w-full text-center py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100/80 cursor-pointer"
                        >
                          Request Pending
                        </button>
                      ) : request?.status === "Approved" ? (
                        <div className="w-full text-center py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs">
                          Restock Approved
                        </div>
                      ) : request?.status === "Rejected" ? (
                        <div className="flex gap-2">
                          <div className="flex-1 text-center py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs">
                            Rejected
                          </div>
                          <button
                            onClick={() => handleContactAdmin(item)}
                            className="flex-1 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs hover:bg-stone-50"
                          >
                            Contact Admin
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleContactAdmin(item)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs shadow-2xs hover:bg-stone-50"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-stone-400" /> Contact Admin
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── TOAST NOTIFICATIONS CONTAINER ── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl border border-[#63131d]/20 bg-white/95 p-4 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-4 duration-300"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : toast.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === "error" && <XCircle className="w-5 h-5 text-red-600" />}
              {toast.type === "info" && <Clock className="w-5 h-5 text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-900 text-sm">{toast.title}</p>
              <p className="text-xs text-stone-600 mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
