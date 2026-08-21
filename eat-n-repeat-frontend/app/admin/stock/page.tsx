"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { StockCategory, StockCategoryInput, StockItem, StockItemInput, StockRequest } from "@/lib/admin/types";
import {
  Package,
  Plus,
  Minus,
  History,
  Edit2,
  Trash2,
  Archive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  FolderPlus,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type LocalStockHistoryLog = {
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

const emptyStockForm: StockItemInput = {
  name: "",
  categoryId: "",
  quantity: 0,
  unit: "pcs",
  lowStockThreshold: 5,
};

const emptyCategoryForm: StockCategoryInput = {
  name: "",
};

export default function StockManagementPage() {
  const {
    stockItems,
    stockCategories,
    addStockItem,
    updateStockItem,
    archiveStockItem,
    addStockCategory,
    updateStockCategory,
    archiveStockCategory,
    getStockCategoryName,
    stockRequests,
    updateStockRequestStatus,
    getStockItemsByCategory,
  } = useAdminData();

  // Filter State
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Modals & Form State
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
  const [stockForm, setStockForm] = useState<StockItemInput>(emptyStockForm);
  const [categoryForm, setCategoryForm] = useState<StockCategoryInput>(emptyCategoryForm);

  // Quick Stock Actions State (Add / Remove)
  const [quickAdjustItem, setQuickAdjustItem] = useState<{ item: StockItem; type: "add" | "remove" } | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustStaffName, setAdjustStaffName] = useState<string>("Café Owner");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Stock History Logs State
  const [historyLogs, setHistoryLogs] = useState<LocalStockHistoryLog[]>([]);
  const [historyModalItem, setHistoryModalItem] = useState<StockItem | null>(null);

  // Restock Request Resolution State
  const [resolvingRequest, setResolvingRequest] = useState<{ req: StockRequest; action: "Approved" | "Rejected" } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [autoAddStockOnApprove, setAutoAddStockOnApprove] = useState(true);

  // Low Stock Items Analysis
  const lowStockItems = useMemo(
    () => stockItems.filter((i) => i.quantity <= i.lowStockThreshold),
    [stockItems]
  );

  // Filtered Stock Items List
  const filteredItems = useMemo(() => {
    if (filterCategory === "low_stock_only") {
      return lowStockItems;
    }
    if (filterCategory === "all") {
      return stockItems;
    }
    return stockItems.filter((item) => item.categoryId === filterCategory);
  }, [stockItems, filterCategory, lowStockItems]);

  // Helper to append a stock history log
  const logStockChange = (
    item: StockItem,
    action: "Added" | "Removed" | "Updated" | "Restocked",
    changeQty: number,
    prevQty: number,
    newQty: number,
    performedBy: string,
    reason?: string
  ) => {
    const newLog: LocalStockHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stockItemId: item.id,
      itemName: item.name,
      action,
      changeQty,
      prevQty,
      newQty,
      performedBy: performedBy || "Café Owner",
      timestamp: new Date().toISOString(),
      reason: reason || undefined,
    };

    setHistoryLogs((prev) => [newLog, ...prev]);
  };

  // Stock Status Helper
  const getStockStatusInfo = (item: StockItem) => {
    if (item.quantity <= 0) {
      return {
        label: "Out of Stock",
        bg: "bg-rose-50 text-rose-800 border-rose-200",
        color: "text-rose-700",
      };
    }
    if (item.quantity <= item.lowStockThreshold) {
      return {
        label: "Low Stock",
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        color: "text-amber-700",
      };
    }
    return {
      label: "In Stock",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      color: "text-emerald-700",
    };
  };

  // Handlers for Adding/Editing Items
  function openCreateStock() {
    setEditingStock(null);
    setStockForm({
      ...emptyStockForm,
      categoryId: stockCategories[0]?.id ?? "",
    });
    setStockModalOpen(true);
  }

  function openEditStock(item: StockItem) {
    setEditingStock(item);
    setStockForm({
      name: item.name,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
    });
    setStockModalOpen(true);
  }

  function handleStockSubmit() {
    if (!stockForm.name.trim() || !stockForm.categoryId || !stockForm.unit.trim()) {
      return;
    }

    if (editingStock) {
      const prevQty = editingStock.quantity;
      updateStockItem(editingStock.id, stockForm);
      if (prevQty !== stockForm.quantity) {
        logStockChange(
          editingStock,
          "Updated",
          stockForm.quantity - prevQty,
          prevQty,
          stockForm.quantity,
          "Admin",
          "Manual inventory edit"
        );
      }
    } else {
      addStockItem(stockForm);
    }
    setStockModalOpen(false);
  }

  function handleStockDelete(item: StockItem) {
    if (confirm(`Archive stock item "${item.name}"?`)) {
      archiveStockItem(item.id);
    }
  }

  // Handlers for Quick Adjust (+ Add / - Remove Stock)
  function openQuickAdjust(item: StockItem, type: "add" | "remove") {
    setQuickAdjustItem({ item, type });
    setAdjustQty(1);
    setAdjustReason("");
    setValidationError(null);
  }

  function handleConfirmQuickAdjust() {
    if (!quickAdjustItem) return;
    const { item, type } = quickAdjustItem;

    if (!adjustQty || adjustQty <= 0) {
      setValidationError("Please enter a valid positive quantity.");
      return;
    }

    if (type === "remove" && adjustQty > item.quantity) {
      setValidationError(
        `Cannot remove ${adjustQty} ${item.unit} — only ${item.quantity} ${item.unit} currently available in stock!`
      );
      return;
    }

    const prevQty = item.quantity;
    const changeQty = type === "add" ? adjustQty : -adjustQty;
    const newQty = Math.max(0, prevQty + changeQty);

    updateStockItem(item.id, {
      ...item,
      quantity: newQty,
    });

    logStockChange(
      item,
      type === "add" ? "Added" : "Removed",
      changeQty,
      prevQty,
      newQty,
      adjustStaffName,
      adjustReason
    );

    setQuickAdjustItem(null);
  }

  // Handlers for Categories
  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: StockCategory) {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setCategoryModalOpen(true);
  }

  function handleCategorySubmit() {
    if (!categoryForm.name.trim()) return;

    if (editingCategory) {
      updateStockCategory(editingCategory.id, categoryForm);
    } else {
      addStockCategory(categoryForm);
    }
    setCategoryModalOpen(false);
  }

  function handleCategoryDelete(category: StockCategory) {
    const itemCount = getStockItemsByCategory(category.id).length;
    if (itemCount > 0) {
      alert(`Cannot delete "${category.name}" — ${itemCount} stock item(s) still use this category.`);
      return;
    }

    if (confirm(`Archive stock category "${category.name}"?`)) {
      archiveStockCategory(category.id);
    }
  }

  // Handlers for Restock Requests Resolution
  function handleResolveSubmit() {
    if (!resolvingRequest) return;
    const { req, action } = resolvingRequest;

    updateStockRequestStatus(req.id, action, adminNote);

    // If approved and auto-add stock is enabled, credit the stock directly
    if (action === "Approved" && autoAddStockOnApprove) {
      const matchedItem = stockItems.find((i) => i.id === req.ingredientId) || stockItems.find((i) => i.name.toLowerCase() === req.ingredientName.toLowerCase());

      if (matchedItem) {
        const prevQty = matchedItem.quantity;
        const addQty = req.threshold || 5;
        const newQty = prevQty + addQty;

        updateStockItem(matchedItem.id, {
          ...matchedItem,
          quantity: newQty,
        });

        logStockChange(
          matchedItem,
          "Restocked",
          addQty,
          prevQty,
          newQty,
          req.staffName || "Staff",
          `Restock request approved by admin`
        );
      }
    }

    setResolvingRequest(null);
    setAdminNote("");
  }

  return (
    <>
      <AdminPageHeader
        badge="Inventory"
        title="Stock Management"
        subtitle="Monitor café ingredient inventory, adjustments, restock requests, and stock history."
      />

      {/* 1. TOP SUMMARY CARDS (CLICKABLE LOW STOCK CARD) */}
      <section className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Items</p>
          <p className="font-serif text-3xl font-bold text-[#800000] mt-2">{stockItems.length}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Active inventory ingredients</p>
        </div>

        <div className="admin-stat-card rounded-2xl p-5 pl-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Stock Categories</p>
          <p className="font-serif text-3xl font-bold text-[#800000] mt-2">{stockCategories.length}</p>
          <p className="mt-1 text-xs font-semibold text-stone-600">Ingredient categories</p>
        </div>

        {/* CLICKABLE LOW STOCK ALERTS CARD */}
        <div
          onClick={() => setFilterCategory("low_stock_only")}
          className={`admin-stat-card rounded-2xl p-5 pl-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] border ${
            filterCategory === "low_stock_only"
              ? "ring-2 ring-amber-500 bg-amber-50/80"
              : "hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Low Stock Alerts</p>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="font-serif text-3xl font-bold text-amber-900 mt-2">{lowStockItems.length}</p>
          <p className="mt-1 text-xs font-bold text-amber-700 underline flex items-center gap-1">
            Click to filter low stock items <ArrowRight className="h-3 w-3" />
          </p>
        </div>
      </section>

      {/* 2. RESTOCK REQUESTS PANEL */}
      <section className="mb-6">
        <AdminPanel title="Restock Requests" subtitle="Incoming staff inventory restock requests">
          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full min-w-[760px] text-left text-xs align-middle">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4">Status / Qty</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {[...(stockRequests || [])]
                  .sort((a, b) => {
                    if (a.status === "Pending" && b.status !== "Pending") return -1;
                    if (a.status !== "Pending" && b.status === "Pending") return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map((req) => (
                    <tr key={req.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#800000] text-sm">{req.ingredientName}</p>
                        <p className="text-stone-500 text-[11px]">Threshold: {req.threshold} {req.unit || "units"}</p>
                        {(req.status === "Approved" || req.status === "Rejected") && req.adminNote && (
                          <p className="text-[11px] text-stone-600 mt-1 bg-stone-50 p-1.5 rounded border border-stone-200">
                            <span className="font-bold text-stone-700">Admin Note:</span> {req.adminNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-stone-900 text-sm">{req.currentQuantity} {req.unit || "units"}</span>
                          {req.status === "Pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full w-fit">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {req.status === "Approved" && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          )}
                          {req.status === "Rejected" && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full w-fit">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-stone-800 font-semibold">{req.staffName}</td>
                      <td className="py-3 px-4 text-stone-500">{new Date(req.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        {req.status === "Pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setResolvingRequest({ req, action: "Approved" });
                                setAdminNote("");
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setResolvingRequest({ req, action: "Rejected" });
                                setAdminNote("");
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 font-bold">{req.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {(!stockRequests || stockRequests.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-stone-500 font-medium">
                      No restock requests at the moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </section>

      {/* 3. MAIN INVENTORY SECTION (CATEGORY PILLS + INVENTORY TABLE) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] mb-6">
        <AdminPanel
          title="Inventory Catalog"
          subtitle="Real-time stock quantities &amp; quick adjustment actions"
          action={
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="secondary" onClick={openCreateCategory} className="text-xs">
                + Category
              </AdminButton>
              <AdminButton onClick={openCreateStock} className="text-xs">
                + Add Item
              </AdminButton>
            </div>
          }
        >
          {/* CATEGORY FILTER PILLS WITH ITEM COUNTS */}
          <div className="border-b border-stone-200/80 px-4 py-3 bg-stone-50/50">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterCategory("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  filterCategory === "all"
                    ? "bg-[#800000] text-white shadow-sm"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                }`}
              >
                All Items ({stockItems.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterCategory("low_stock_only")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  filterCategory === "low_stock_only"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                ⚠️ Low Stock ({lowStockItems.length})
              </button>

              {stockCategories.map((category) => {
                const count = getStockItemsByCategory(category.id).length;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFilterCategory(category.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      filterCategory === category.id
                        ? "bg-[#800000] text-white shadow-sm"
                        : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {category.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* DESKTOP INVENTORY TABLE */}
          <div className="hidden md:block overflow-x-auto px-2 pb-2">
            <table className="w-full text-left text-xs align-middle">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Ingredient / Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Qty</th>
                  <th className="py-3 px-4">Minimum Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {filteredItems.map((item) => {
                  const statusInfo = getStockStatusInfo(item);
                  const categoryName = getStockCategoryName(item.categoryId);

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#800000] text-sm">{item.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-bold">
                          {categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-stone-900 text-base">
                        {item.quantity} <span className="text-xs font-bold text-stone-500">{item.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 font-semibold">
                        {item.lowStockThreshold} {item.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.bg}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openQuickAdjust(item, "add")}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                            title="Add Stock"
                          >
                            <Plus className="h-3.5 w-3.5" /> Stock
                          </button>
                          <button
                            onClick={() => openQuickAdjust(item, "remove")}
                            className="px-2.5 py-1 bg-rose-50 text-rose-800 rounded-lg text-xs font-bold border border-rose-200 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                            title="Remove Stock"
                          >
                            <Minus className="h-3.5 w-3.5" /> Stock
                          </button>
                          <button
                            onClick={() => setHistoryModalItem(item)}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                            title="Stock History Logs"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditStock(item)}
                            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleStockDelete(item)}
                            className="p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                            title="Archive Item"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-stone-500 font-medium">
                      No stock items found matching your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE RESPONSIVE CARDS (320px–768px) */}
          <div className="md:hidden space-y-3 p-3">
            {filteredItems.map((item) => {
              const statusInfo = getStockStatusInfo(item);
              const categoryName = getStockCategoryName(item.categoryId);

              return (
                <div key={item.id} className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-[#800000] text-base">{item.name}</p>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold mt-1">
                        {categoryName}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-stone-500">Current Qty</p>
                      <p className="text-xl font-black text-stone-900 mt-0.5">
                        {item.quantity} <span className="text-xs font-bold text-stone-500">{item.unit}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-stone-500">Minimum</p>
                      <p className="text-xs font-bold text-stone-700 mt-1">{item.lowStockThreshold} {item.unit}</p>
                    </div>
                  </div>

                  {/* MOBILE ACTIONS */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-1.5 flex-wrap">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openQuickAdjust(item, "add")}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                      <button
                        onClick={() => openQuickAdjust(item, "remove")}
                        className="px-3 py-1.5 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-1"
                      >
                        <Minus className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setHistoryModalItem(item)}
                        className="p-2 text-stone-600 bg-stone-100 rounded-xl text-xs font-bold"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditStock(item)}
                        className="p-2 text-stone-600 bg-stone-100 rounded-xl text-xs font-bold"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-xs text-stone-500 font-medium">
                No stock items match your filter.
              </div>
            )}
          </div>
        </AdminPanel>

        {/* SIDEBAR: STOCK CATEGORIES LIST */}
        <AdminPanel title="Stock Categories" subtitle="Ingredient groupings">
          <div className="space-y-3 px-4 py-4">
            {stockCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3 shadow-2xs"
              >
                <div>
                  <p className="font-bold text-[#800000] text-sm">{category.name}</p>
                  <p className="text-xs text-stone-500 font-medium">
                    {getStockItemsByCategory(category.id).length} items
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditCategory(category)}
                    className="p-1 text-stone-500 hover:text-[#800000] transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleCategoryDelete(category)}
                    className="p-1 text-stone-400 hover:text-rose-600 transition"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      {/* 4. QUICK STOCK ADJUSTMENT MODAL (+ ADD / - REMOVE) */}
      {quickAdjustItem && (
        <AdminModal
          open={Boolean(quickAdjustItem)}
          title={`${quickAdjustItem.type === "add" ? "Add Stock" : "Remove Stock"}: ${quickAdjustItem.item.name}`}
          onClose={() => setQuickAdjustItem(null)}
          footer={
            <>
              <AdminButton variant="secondary" onClick={() => setQuickAdjustItem(null)}>
                Cancel
              </AdminButton>
              <button
                onClick={handleConfirmQuickAdjust}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md transition cursor-pointer ${
                  quickAdjustItem.type === "add"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm {quickAdjustItem.type === "add" ? "Stock Addition" : "Stock Removal"}
              </button>
            </>
          }
        >
          {validationError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
              {validationError}
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-[#800000] text-sm">{quickAdjustItem.item.name}</p>
                <p className="text-stone-500 font-medium">Category: {getStockCategoryName(quickAdjustItem.item.categoryId)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-500 uppercase">Current Stock</p>
                <p className="text-base font-black text-stone-900">
                  {quickAdjustItem.item.quantity} {quickAdjustItem.item.unit}
                </p>
              </div>
            </div>

            <AdminField label={`Quantity to ${quickAdjustItem.type === "add" ? "Add" : "Remove"} (${quickAdjustItem.item.unit})`}>
              <AdminInput
                type="number"
                min={1}
                value={adjustQty || ""}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                placeholder="e.g. 5"
              />
            </AdminField>

            <AdminField label="Reason / Note (Optional)">
              <AdminTextarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={quickAdjustItem.type === "add" ? "e.g. Received new supplier shipment" : "e.g. Used for daily kitchen prep"}
                rows={2}
              />
            </AdminField>
          </div>
        </AdminModal>
      )}

      {/* 5. ITEM STOCK HISTORY MODAL */}
      {historyModalItem && (
        <AdminModal
          open={Boolean(historyModalItem)}
          title={`Stock History: ${historyModalItem.name}`}
          onClose={() => setHistoryModalItem(null)}
          footer={
            <AdminButton variant="secondary" onClick={() => setHistoryModalItem(null)}>
              Close
            </AdminButton>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-[#800000]">{historyModalItem.name}</p>
                <p className="text-[10px] text-stone-500">Unit: {historyModalItem.unit}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-500 uppercase">Current Qty</p>
                <p className="text-sm font-black text-stone-900">{historyModalItem.quantity} {historyModalItem.unit}</p>
              </div>
            </div>

            <p className="text-xs font-bold text-stone-700 pt-2 border-t border-stone-200">Audit Trail Logs</p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
              {historyLogs
                .filter((log) => log.stockItemId === historyModalItem.id)
                .map((log) => (
                  <div key={log.id} className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        log.action === "Added" || log.action === "Restocked"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : log.action === "Removed"
                          ? "bg-rose-50 text-rose-800 border border-rose-200"
                          : "bg-stone-100 text-stone-700 border border-stone-200"
                      }`}>
                        {log.action} ({log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty} {historyModalItem.unit})
                      </span>
                      <span className="text-[10px] text-stone-400 font-semibold">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-stone-600 text-[11px] pt-1">
                      <span>Shift: <strong>{log.prevQty}</strong> → <strong>{log.newQty} {historyModalItem.unit}</strong></span>
                      <span>By: <strong>{log.performedBy}</strong></span>
                    </div>

                    {log.reason && (
                      <p className="text-[10px] text-stone-500 italic bg-stone-50 p-1.5 rounded border border-stone-100 mt-1">
                        &ldquo;{log.reason}&rdquo;
                      </p>
                    )}
                  </div>
                ))}

              {historyLogs.filter((log) => log.stockItemId === historyModalItem.id).length === 0 && (
                <div className="p-6 text-center text-xs text-stone-500 font-medium bg-stone-50 rounded-xl">
                  No stock adjustment logs recorded for this item yet. Quick stock adjustments (+ Add / - Remove) will appear here.
                </div>
              )}
            </div>
          </div>
        </AdminModal>
      )}

      {/* 6. ADD / EDIT STOCK ITEM MODAL */}
      <AdminModal
        open={stockModalOpen}
        title={editingStock ? "Edit Stock Item" : "Add New Stock Item"}
        onClose={() => setStockModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setStockModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleStockSubmit}>
              {editingStock ? "Save Changes" : "Add Stock Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <AdminField label="Item / Ingredient Name">
            <AdminInput
              value={stockForm.name}
              onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
              placeholder="e.g. Milk Tea Powder"
            />
          </AdminField>

          <AdminField label="Category">
            <AdminSelect
              value={stockForm.categoryId}
              onChange={(e) => setStockForm({ ...stockForm, categoryId: e.target.value })}
            >
              {stockCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField label="Current Quantity">
              <AdminInput
                type="number"
                min={0}
                value={stockForm.quantity || ""}
                onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })}
              />
            </AdminField>

            <AdminField label="Unit">
              <AdminInput
                value={stockForm.unit}
                onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                placeholder="kg, L, pcs, cans"
              />
            </AdminField>

            <AdminField label="Low Stock Threshold">
              <AdminInput
                type="number"
                min={1}
                value={stockForm.lowStockThreshold || ""}
                onChange={(e) => setStockForm({ ...stockForm, lowStockThreshold: Number(e.target.value) })}
              />
            </AdminField>
          </div>
        </div>
      </AdminModal>

      {/* 7. ADD / EDIT CATEGORY MODAL */}
      <AdminModal
        open={categoryModalOpen}
        title={editingCategory ? "Edit Stock Category" : "Add Stock Category"}
        onClose={() => setCategoryModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleCategorySubmit}>
              {editingCategory ? "Save Changes" : "Add Category"}
            </AdminButton>
          </>
        }
      >
        <AdminField label="Category Name">
          <AdminInput
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ name: e.target.value })}
            placeholder="e.g. Dairy"
          />
        </AdminField>
      </AdminModal>

      {/* 8. RESTOCK REQUEST RESOLUTION MODAL */}
      {resolvingRequest && (
        <AdminModal
          open={!!resolvingRequest}
          title={`${resolvingRequest.action === "Approved" ? "Approve" : "Reject"} Restock Request`}
          onClose={() => setResolvingRequest(null)}
          footer={
            <>
              <AdminButton variant="secondary" onClick={() => setResolvingRequest(null)}>
                Cancel
              </AdminButton>
              <button
                onClick={handleResolveSubmit}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md transition cursor-pointer ${
                  resolvingRequest.action === "Approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm {resolvingRequest.action}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-[#800000] text-base">{resolvingRequest.req.ingredientName}</h4>
                  <p className="text-xs font-bold text-stone-700 mt-0.5">
                    {resolvingRequest.req.currentQuantity} {resolvingRequest.req.unit || "units"} remaining
                  </p>
                </div>
                <span className="text-xs font-bold text-stone-600 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                  Threshold: {resolvingRequest.req.threshold} {resolvingRequest.req.unit || "units"}
                </span>
              </div>
              <div className="text-[11px] text-stone-500 pt-2 border-t border-stone-200 flex flex-wrap justify-between gap-2">
                <span>Requested by: <strong className="text-stone-800">{resolvingRequest.req.staffName}</strong></span>
                <span>Date: <strong className="text-stone-800">{new Date(resolvingRequest.req.createdAt).toLocaleString()}</strong></span>
              </div>
            </div>

            {resolvingRequest.action === "Approved" && (
              <label className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAddStockOnApprove}
                  onChange={(e) => setAutoAddStockOnApprove(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-bold text-emerald-900">
                  Automatically add {resolvingRequest.req.threshold || 5} {resolvingRequest.req.unit || "units"} to stock inventory upon approval
                </span>
              </label>
            )}

            <AdminField label="Admin Response Note (Optional)">
              <AdminTextarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Enter a response note for staff..."
                rows={2}
              />
            </AdminField>
          </div>
        </AdminModal>
      )}
    </>
  );
}
