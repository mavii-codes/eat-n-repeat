"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit3,
  Filter,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  X,
  ChevronDown,
  MessageSquare,
  MoreVertical,
  Clock,
} from "lucide-react";
import type { StockItem, StockItemInput, StockCategory } from "@/lib/admin/types";
import { useAdminData } from "@/context/AdminDataContext";
import { useAuth } from "@/context/AuthContext";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminSelect,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";

/* ── Types ──────────────────────────────────────── */
type StockHistoryEntry = {
  id: string;
  itemId: string;
  itemName: string;
  action: "add" | "deduct" | "create" | "edit";
  quantity: number;
  reason: string;
  staffName: string;
  timestamp: string;
};

type Toast = {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info";
};

/* ── Props ──────────────────────────────────────── */
type StaffInventoryTabProps = {
  stockItems: StockItem[];
  stockCategories: StockCategory[];
  getStockCategoryName: (id: string) => string;
  addStockItem: (input: StockItemInput) => void;
  updateStockItem: (id: string, input: StockItemInput) => void;
  deleteStockItem: (id: string) => void;
  staffName: string;
};

/* ── UNITS ──────────────────────────────────────── */
const UNIT_OPTIONS = ["kg", "g", "L", "mL", "pcs", "packs", "bottles", "cans", "boxes"];

const ADJUSTMENT_REASONS = [
  "New delivery",
  "Supplier restock",
  "Damaged item",
  "Expired item",
  "Manual adjustment",
  "Used for preparation",
  "Inventory count correction",
  "Returned to supplier",
];

/* ── Component ──────────────────────────────────── */
export function StaffInventoryTab({
  stockItems,
  stockCategories,
  getStockCategoryName,
  addStockItem,
  updateStockItem,
  deleteStockItem,
  staffName,
}: StaffInventoryTabProps) {
  const { user } = useAuth();
  const { stockRequests, addStockRequest } = useAdminData();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Toast Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add/Edit Modal
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [stockForm, setStockForm] = useState({
    name: "",
    categoryId: stockCategories[0]?.id || "",
    quantity: 0,
    unit: "kg",
    lowStockThreshold: 5,
    supplier: "",
    notes: "",
  });

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState(ADJUSTMENT_REASONS[0]);

  // Stock History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItemFilter, setHistoryItemFilter] = useState("all");
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);

  // Action Menu state for items
  const [activeActionItemId, setActiveActionItemId] = useState<string | null>(null);

  /* ── Toast Helper ────────────────── */
  function showToast(title: string, message: string, type: "success" | "error" | "info" = "success") {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  /* ── Monitor Admin Request Status Changes ── */
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

  /* ── Computed ────────────────── */
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
      threshold: item.lowStockThreshold,
      message: `Restock request for ${item.name}`,
    });

    showToast(
      "Restock request sent",
      `The Admin has been notified about ${item.name}.`,
      "success"
    );
  }

  /* ── CRUD Handlers ────────────────── */
  function openAddModal() {
    setEditingItem(null);
    setStockForm({
      name: "",
      categoryId: stockCategories[0]?.id || "",
      quantity: 0,
      unit: "kg",
      lowStockThreshold: 5,
      supplier: "",
      notes: "",
    });
    setStockModalOpen(true);
  }

  function openEditModal(item: StockItem) {
    setEditingItem(item);
    setStockForm({
      name: item.name,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      supplier: "",
      notes: "",
    });
    setStockModalOpen(true);
    setActiveActionItemId(null);
  }

  function handleSaveItem() {
    if (!stockForm.name.trim()) return;
    const input: StockItemInput = {
      name: stockForm.name.trim(),
      categoryId: stockForm.categoryId,
      quantity: stockForm.quantity,
      unit: stockForm.unit,
      lowStockThreshold: stockForm.lowStockThreshold,
    };
    if (editingItem) {
      updateStockItem(editingItem.id, input);
      addHistoryEntry(editingItem.id, editingItem.name, "edit", 0, "Item details updated");
    } else {
      addStockItem(input);
      addHistoryEntry("new", stockForm.name, "create", stockForm.quantity, "Initial stock entry");
    }
    setStockModalOpen(false);
  }

  function openAdjustModal(item: StockItem, type: "add" | "deduct") {
    setAdjustItem(item);
    setAdjustType(type);
    setAdjustQty(0);
    setAdjustReason(ADJUSTMENT_REASONS[0]);
    setAdjustModalOpen(true);
    setActiveActionItemId(null);
  }

  function handleAdjust() {
    if (!adjustItem || adjustQty <= 0) return;
    const newQty =
      adjustType === "add"
        ? adjustItem.quantity + adjustQty
        : Math.max(0, adjustItem.quantity - adjustQty);
    updateStockItem(adjustItem.id, {
      name: adjustItem.name,
      categoryId: adjustItem.categoryId,
      quantity: newQty,
      unit: adjustItem.unit,
      lowStockThreshold: adjustItem.lowStockThreshold,
    });
    addHistoryEntry(
      adjustItem.id,
      adjustItem.name,
      adjustType,
      adjustQty,
      adjustReason
    );
    setAdjustModalOpen(false);
  }

  function addHistoryEntry(
    itemId: string,
    itemName: string,
    action: StockHistoryEntry["action"],
    quantity: number,
    reason: string
  ) {
    setStockHistory((prev) => [
      {
        id: `sh-${Date.now()}`,
        itemId,
        itemName,
        action,
        quantity,
        reason,
        staffName: staffName || user?.name || "Staff",
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  /* ── RENDER ──────────────────── */
  return (
    <div className="space-y-6">
      {/* TITLE & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#63131d]">
            Inventory Ledger
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Real-time stock quantities linked to order processing
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-stone-700 shadow-2xs hover:bg-white hover:border-[#63131d]/30 transition-all cursor-pointer"
          >
            <History className="h-4 w-4 text-[#63131d]" /> History
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#63131d] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#4d0e16] transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER CARD */}
      <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-6">
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
                    <p className="text-xs text-stone-400 mt-1">Try adjusting your search or category filter.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const status = getItemStatus(item);
                  const isLow = status === "low-stock" || status === "out-of-stock";
                  const categoryName = getStockCategoryName(item.categoryId);

                  // Check for restock request status
                  const request = (stockRequests || []).find((r) => r.ingredientId === item.id);

                  // Calculate quantity progress bar percentage
                  let progressPercent = 100;
                  if (item.lowStockThreshold > 0) {
                    const ratio = item.quantity / item.lowStockThreshold;
                    if (isLow) {
                      progressPercent = Math.min(100, Math.max(12, ratio * 50));
                    } else {
                      progressPercent = Math.min(100, Math.max(30, (item.quantity / (item.lowStockThreshold * 2.5)) * 100));
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
                          {/* Request / Contact Admin Status Button */}
                          {request?.status === "Pending" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs shadow-2xs">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Request Pending
                            </span>
                          ) : request?.status === "Approved" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                            </span>
                          ) : isLow ? (
                            <button
                              onClick={() => handleContactAdmin(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs hover:bg-stone-50 hover:border-[#63131d]/30 transition-colors shadow-2xs cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400" /> Contact Admin
                            </button>
                          ) : (
                            <span className="text-stone-300 font-bold px-2">—</span>
                          )}

                          {/* Options dropdown menu for full editing capabilities */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveActionItemId(
                                  activeActionItemId === item.id ? null : item.id
                                )
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {activeActionItemId === item.id && (
                              <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg space-y-1 text-left">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-stone-500" /> Edit Item
                                </button>
                                <button
                                  onClick={() => openAdjustModal(item, "add")}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2 cursor-pointer"
                                >
                                  <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" /> Add Stock
                                </button>
                                <button
                                  onClick={() => openAdjustModal(item, "deduct")}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 cursor-pointer"
                                >
                                  <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" /> Deduct Stock
                                </button>
                              </div>
                            )}
                          </div>
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

              const request = (stockRequests || []).find((r) => r.ingredientId === item.id);

              let progressPercent = 100;
              if (item.lowStockThreshold > 0) {
                const ratio = item.quantity / item.lowStockThreshold;
                if (isLow) {
                  progressPercent = Math.min(100, Math.max(12, ratio * 50));
                } else {
                  progressPercent = Math.min(100, Math.max(30, (item.quantity / (item.lowStockThreshold * 2.5)) * 100));
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
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-stone-500">Remaining</span>
                      <span className="text-stone-900 uppercase">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLow ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 text-right">Threshold: {item.lowStockThreshold} {item.unit}</p>
                  </div>

                  {/* Restock Request status on Mobile */}
                  {isLow && (
                    <div className="pt-1">
                      {request?.status === "Pending" ? (
                        <div className="w-full text-center py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs">
                          Request Pending
                        </div>
                      ) : request?.status === "Approved" ? (
                        <div className="w-full text-center py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs">
                          Restock Approved
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

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold text-stone-700 bg-stone-50 border border-stone-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => openAdjustModal(item, "add")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" /> + Stock
                    </button>
                    <button
                      onClick={() => openAdjustModal(item, "deduct")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200"
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" /> - Stock
                    </button>
                  </div>
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
            className="pointer-events-auto rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-4 duration-300"
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : toast.type === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === "error" && <XCircle className="w-5 h-5" />}
              {toast.type === "info" && <Clock className="w-5 h-5" />}
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

      {/* ── ADD/EDIT STOCK ITEM MODAL ── */}
      <AdminModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title={editingItem ? "Edit Stock Item" : "Add Stock Item"}
        footer={
          <div className="flex gap-3 justify-end">
            <AdminButton variant="secondary" onClick={() => setStockModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSaveItem}>
              {editingItem ? "Save Changes" : "Add Item"}
            </AdminButton>
          </div>
        }
      >
        <div className="space-y-4">
          <AdminField label="Item Name" required>
            <AdminInput
              value={stockForm.name}
              onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
              placeholder="e.g. Matcha Powder"
            />
          </AdminField>
          <div className="grid grid-cols-2 gap-3">
            <AdminField label="Category" required>
              <AdminSelect
                value={stockForm.categoryId}
                onChange={(e) => setStockForm({ ...stockForm, categoryId: e.target.value })}
              >
                {stockCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Unit" required>
              <AdminSelect
                value={stockForm.unit}
                onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </AdminSelect>
            </AdminField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AdminField label="Quantity" required>
              <AdminInput
                type="number"
                min={0}
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })}
              />
            </AdminField>
            <AdminField label="Low Stock Threshold" required>
              <AdminInput
                type="number"
                min={0}
                value={stockForm.lowStockThreshold}
                onChange={(e) =>
                  setStockForm({ ...stockForm, lowStockThreshold: Number(e.target.value) })
                }
              />
            </AdminField>
          </div>
        </div>
      </AdminModal>

      {/* ── STOCK ADJUSTMENT MODAL ── */}
      <AdminModal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={adjustType === "add" ? "Add Stock" : "Deduct Stock"}
        footer={
          <div className="flex gap-3 justify-end">
            <AdminButton variant="secondary" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleAdjust}>
              {adjustType === "add" ? "Add Stock" : "Deduct Stock"}
            </AdminButton>
          </div>
        }
      >
        {adjustItem && (
          <div className="space-y-4">
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
              <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">Item</p>
              <p className="font-bold text-[#5c141d] mt-0.5">{adjustItem.name}</p>
              <p className="text-xs text-stone-600 mt-1">
                Current stock:{" "}
                <span className="font-bold">
                  {adjustItem.quantity} {adjustItem.unit}
                </span>
              </p>
            </div>
            <AdminField
              label={adjustType === "add" ? "Quantity to Add" : "Quantity to Deduct"}
              required
            >
              <AdminInput
                type="number"
                min={1}
                max={adjustType === "deduct" ? adjustItem.quantity : undefined}
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                placeholder="0"
              />
            </AdminField>
            <AdminField label="Reason" required>
              <AdminSelect
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </AdminSelect>
            </AdminField>
          </div>
        )}
      </AdminModal>

      {/* ── STOCK HISTORY MODAL ── */}
      <AdminModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Stock Movement History"
        footer={
          <AdminButton variant="secondary" onClick={() => setHistoryOpen(false)}>
            Close
          </AdminButton>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <select
              value={historyItemFilter}
              onChange={(e) => setHistoryItemFilter(e.target.value)}
              className="appearance-none w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm focus:outline-none"
            >
              <option value="all">All Items</option>
              {stockItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-400 pointer-events-none" />
          </div>

          {stockHistory.filter((h) => historyItemFilter === "all" || h.itemId === historyItemFilter).length === 0 ? (
            <div className="text-center py-8 text-stone-400">
              <History className="h-8 w-8 mx-auto mb-2 text-stone-300" />
              <p className="text-sm font-semibold">No stock movements recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {stockHistory
                .filter((h) => historyItemFilter === "all" || h.itemId === historyItemFilter)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-stone-800">{entry.itemName}</p>
                      <p className="text-stone-500">{entry.reason}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{entry.staffName} &middot; {formatTimestamp(entry.timestamp)}</p>
                    </div>
                    <span className={`font-bold ${entry.action === "add" ? "text-emerald-600" : "text-red-600"}`}>
                      {entry.action === "add" ? "+" : "-"}{entry.quantity}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
