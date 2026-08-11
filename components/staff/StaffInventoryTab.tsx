"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Edit3, Filter, Package, AlertTriangle, CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle, History, X, ChevronDown } from "lucide-react";
import type { StockItem, StockItemInput, StockCategory } from "@/lib/admin/types";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";

/* ── Types ──────────────────────────────────────── */
type StockStatus = "all" | "in-stock" | "low-stock" | "out-of-stock";

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
  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  // Detail view modal
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);

  /* ── Computed ────────────────── */
  const getItemStatus = (item: StockItem) => {
    if (item.quantity === 0) return "out-of-stock";
    if (item.quantity <= item.lowStockThreshold) return "low-stock";
    return "in-stock";
  };

  const summary = useMemo(() => {
    const total = stockItems.length;
    const inStock = stockItems.filter((i) => i.quantity > i.lowStockThreshold).length;
    const lowStock = stockItems.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
    const outOfStock = stockItems.filter((i) => i.quantity === 0).length;
    return { total, inStock, lowStock, outOfStock };
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    let items = [...stockItems];

    // Search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          getStockCategoryName(i.categoryId).toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((i) => getItemStatus(i) === statusFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      items = items.filter((i) => i.categoryId === categoryFilter);
    }

    return items;
  }, [stockItems, search, statusFilter, categoryFilter, getStockCategoryName]);

  /* ── Handlers ────────────────── */
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
        staffName,
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

  /* ── Status Badge ────────────── */
  function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
      "in-stock": {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        label: "In Stock",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      "low-stock": {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        label: "Low Stock",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
      "out-of-stock": {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        label: "Out of Stock",
        icon: <XCircle className="h-3 w-3" />,
      },
    };
    const c = config[status] || config["in-stock"];
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}
      >
        {c.icon} {c.label}
      </span>
    );
  }

  /* ── History action badge ────── */
  function ActionBadge({ action, qty, unit }: { action: string; qty: number; unit?: string }) {
    if (action === "add")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <ArrowUpCircle className="h-3.5 w-3.5" /> +{qty} {unit || ""}
        </span>
      );
    if (action === "deduct")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
          <ArrowDownCircle className="h-3.5 w-3.5" /> -{qty} {unit || ""}
        </span>
      );
    if (action === "create")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
          <Plus className="h-3.5 w-3.5" /> Created ({qty} {unit || ""})
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600">
        <Edit3 className="h-3.5 w-3.5" /> Edited
      </span>
    );
  }

  /* ── RENDER ──────────────────── */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">
            Inventory
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">
            Inventory &amp; Stock
          </h1>
          <p className="text-sm text-muted">
            Monitor ingredients, stock levels, and inventory activity.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#800000] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#6b0000] transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Stock Item
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Items", value: summary.total, color: "text-[#800000]", bg: "bg-[#800000]/5", borderColor: "border-[#800000]/10", icon: <Package className="h-5 w-5 text-[#800000]/60" /> },
          { label: "In Stock", value: summary.inStock, color: "text-emerald-700", bg: "bg-emerald-50", borderColor: "border-emerald-200", icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "Low Stock", value: summary.lowStock, color: "text-amber-700", bg: "bg-amber-50", borderColor: "border-amber-200", icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
          { label: "Out of Stock", value: summary.outOfStock, color: "text-red-700", bg: "bg-red-50", borderColor: "border-red-200", icon: <XCircle className="h-5 w-5 text-red-500" /> },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border ${card.borderColor} ${card.bg} p-4 backdrop-blur-sm`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{card.label}</p>
              {card.icon}
            </div>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Status filter pills */}
          {([
            { key: "all", label: "All" },
            { key: "in-stock", label: "In Stock" },
            { key: "low-stock", label: "Low Stock" },
            { key: "out-of-stock", label: "Out of Stock" },
          ] as { key: StockStatus; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === f.key
                  ? "bg-[#800000] text-white border-[#800000]"
                  : "bg-white/80 text-stone-600 border-stone-200 hover:border-[#800000]/30"
              }`}
            >
              {f.label}
            </button>
          ))}
          {/* Category dropdown */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none rounded-full border border-stone-200 bg-white/80 pl-3 pr-8 py-1.5 text-xs font-semibold text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {stockCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* HISTORY BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#800000] hover:text-[#600000] transition-colors"
        >
          <History className="h-3.5 w-3.5" /> View Stock History
        </button>
      </div>

      {/* INVENTORY TABLE — Desktop */}
      <AdminPanel title="Inventory Items" subtitle={`${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} found`}>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="px-4 py-3 font-medium rounded-l-lg">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Current Stock</th>
                <th className="px-4 py-3 font-medium">Threshold</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium rounded-r-lg text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Filter className="h-8 w-8 text-muted/30 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-muted">No inventory items found</p>
                    <p className="text-xs text-muted/60 mt-1">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const status = getItemStatus(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{item.name}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {getStockCategoryName(item.categoryId)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-sm">
                          {item.quantity}{" "}
                          <span className="text-xs font-normal text-muted">{item.unit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {item.lowStockThreshold} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-[#800000] hover:bg-[#800000]/5 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openAdjustModal(item, "add")}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Add Stock"
                          >
                            <ArrowUpCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openAdjustModal(item, "deduct")}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Deduct Stock"
                          >
                            <ArrowDownCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View History"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3 p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10">
              <Filter className="h-8 w-8 text-muted/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted">No inventory items found</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const status = getItemStatus(item);
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-stone-200 bg-white/90 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink text-sm">{item.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {getStockCategoryName(item.categoryId)}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <p className="text-muted">Stock</p>
                      <p className="font-bold text-sm text-ink">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Threshold</p>
                      <p className="font-bold text-sm text-ink">
                        {item.lowStockThreshold} {item.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-stone-100">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-stone-600 hover:text-[#800000] hover:bg-[#800000]/5 border border-stone-200 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => openAdjustModal(item, "add")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Add
                    </button>
                    <button
                      onClick={() => openAdjustModal(item, "deduct")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Deduct
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AdminPanel>

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
          <AdminField label="Supplier (Optional)">
            <AdminInput
              value={stockForm.supplier}
              onChange={(e) => setStockForm({ ...stockForm, supplier: e.target.value })}
              placeholder="e.g. Manila Trading Co."
            />
          </AdminField>
          <AdminField label="Notes (Optional)">
            <AdminTextarea
              value={stockForm.notes}
              onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
              placeholder="Any notes about this stock item..."
            />
          </AdminField>
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
              <p className="text-xs text-muted font-semibold uppercase tracking-wider">Item</p>
              <p className="font-bold text-ink mt-0.5">{adjustItem.name}</p>
              <p className="text-xs text-muted mt-1">
                Current stock:{" "}
                <span className="font-semibold text-ink">
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
              {adjustType === "add" && adjustQty > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  New total: {adjustItem.quantity + adjustQty} {adjustItem.unit}
                </p>
              )}
              {adjustType === "deduct" && adjustQty > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  New total: {Math.max(0, adjustItem.quantity - adjustQty)} {adjustItem.unit}
                </p>
              )}
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
          {/* Filter by item */}
          <div className="relative">
            <select
              value={historyItemFilter}
              onChange={(e) => setHistoryItemFilter(e.target.value)}
              className="appearance-none w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]/20"
            >
              <option value="all">All Items</option>
              {stockItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted pointer-events-none" />
          </div>

          {/* History list */}
          {stockHistory.filter(
            (h) => historyItemFilter === "all" || h.itemId === historyItemFilter
          ).length === 0 ? (
            <div className="text-center py-8">
              <History className="h-8 w-8 text-muted/30 mx-auto mb-2" />
              <p className="text-sm text-muted font-semibold">No stock movements recorded yet</p>
              <p className="text-xs text-muted/60 mt-1">
                Adjustments will appear here once stock is added or deducted.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stockHistory
                .filter((h) => historyItemFilter === "all" || h.itemId === historyItemFilter)
                .map((entry) => {
                  const item = stockItems.find((i) => i.id === entry.itemId);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-stone-200 bg-white/80 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{entry.itemName}</p>
                        <p className="text-xs text-muted mt-0.5">{entry.reason}</p>
                        <p className="text-[10px] text-muted/60 mt-0.5">
                          {entry.staffName} &middot; {formatTimestamp(entry.timestamp)}
                        </p>
                      </div>
                      <ActionBadge action={entry.action} qty={entry.quantity} unit={item?.unit} />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </AdminModal>

      {/* ── ITEM DETAIL / HISTORY MODAL ── */}
      <AdminModal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem ? `${detailItem.name} — Details` : ""}
        footer={
          <div className="flex gap-3 justify-end">
            <AdminButton variant="secondary" onClick={() => setDetailItem(null)}>
              Close
            </AdminButton>
            {detailItem && (
              <>
                <AdminButton
                  onClick={() => {
                    setDetailItem(null);
                    openAdjustModal(detailItem, "add");
                  }}
                >
                  Add Stock
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  onClick={() => {
                    setDetailItem(null);
                    openAdjustModal(detailItem, "deduct");
                  }}
                >
                  Deduct Stock
                </AdminButton>
              </>
            )}
          </div>
        }
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Current Stock</p>
                <p className="text-xl font-bold text-ink mt-1">
                  {detailItem.quantity} <span className="text-sm font-normal text-muted">{detailItem.unit}</span>
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Status</p>
                <div className="mt-2">
                  <StatusBadge status={getItemStatus(detailItem)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Category</p>
                <p className="text-sm font-semibold text-ink mt-1">{getStockCategoryName(detailItem.categoryId)}</p>
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Low Stock Threshold</p>
                <p className="text-sm font-semibold text-ink mt-1">{detailItem.lowStockThreshold} {detailItem.unit}</p>
              </div>
            </div>

            {/* Item-specific history */}
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Recent Activity</p>
              {stockHistory.filter((h) => h.itemId === detailItem.id).length === 0 ? (
                <p className="text-xs text-muted/60 py-4 text-center">No activity recorded for this item yet.</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {stockHistory
                    .filter((h) => h.itemId === detailItem.id)
                    .slice(0, 10)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-stone-100 bg-white p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-muted">{entry.reason}</p>
                          <p className="text-[10px] text-muted/60 mt-0.5">
                            {entry.staffName} &middot; {formatTimestamp(entry.timestamp)}
                          </p>
                        </div>
                        <ActionBadge action={entry.action} qty={entry.quantity} unit={detailItem.unit} />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
