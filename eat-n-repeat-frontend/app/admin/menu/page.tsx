"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Link2, PlusCircle, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
import { useAdminData } from "@/context/AdminDataContext";
import type { MenuItem, MenuItemInput } from "@/lib/admin/types";

const emptyForm: MenuItemInput = {
  name: "",
  description: "",
  price: 0,
  categoryId: "",
  available: true,
  sizes: [],
};

export default function MenuItemsPage() {
  const {
    getActiveMenuItems,
    getActiveMenuCategories,
    stockItems,
    stockCategories,
    addMenuItem,
    updateMenuItem,
    archiveMenuItem,
    getMenuCategoryName,
    syncMenuItemsToStock,
  } = useAdminData();

  const menuItems = getActiveMenuItems();
  const menuCategories = getActiveMenuCategories();

  const [searchQuery, setSearchQuery] = useState("");
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        getMenuCategoryName(item.categoryId).toLowerCase().includes(q)
    );
  }, [menuItems, searchQuery, getMenuCategoryName]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemInput>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingMenu, setSyncingMenu] = useState(false);

  const untrackedCount = useMemo(() => {
    return menuItems.filter((i) => !i.stockItemId || i.stockMode === "NONE").length;
  }, [menuItems]);

  async function handleSyncMenu() {
    if (!syncMenuItemsToStock) return;
    setSyncingMenu(true);
    try {
      const res = await syncMenuItemsToStock();
      toast.success(
        `Synchronized! Created ${res.createdStockItems ?? 0} stock items, linked ${res.linkedMenuItems ?? 0} menu items.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to sync menu items to inventory.");
    } finally {
      setSyncingMenu(false);
    }
  }

  // Inventory tracking state
  const [stockMode, setStockMode] = useState<"NONE" | "DIRECT">("NONE");
  const [stockItemId, setStockItemId] = useState<string>("");
  const [isCreatingNewStock, setIsCreatingNewStock] = useState<boolean>(false);
  const [newStockCategory, setNewStockCategory] = useState<string>("");
  const [newStockUnit, setNewStockUnit] = useState<string>("pcs");
  const [newStockLowThreshold, setNewStockLowThreshold] = useState<number>(5);

  // Map of stock items already linked to other menu items
  const linkedStockMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of menuItems) {
      if (item.stockItemId && (!editing || item.id !== editing.id)) {
        map.set(item.stockItemId, item.name);
      }
    }
    return map;
  }, [menuItems, editing]);

  // Detected matching stock item by name
  const matchingStockItem = useMemo(() => {
    const trimmed = form.name.trim().toLowerCase();
    if (!trimmed) return null;
    return stockItems.find((s) => s.name.trim().toLowerCase() === trimmed) ?? null;
  }, [form.name, stockItems]);

  function openCreate() {
    setSubmitError(null);
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: menuCategories[0]?.id ?? "",
    });
    setStockMode("DIRECT");
    setStockItemId("");
    setIsCreatingNewStock(true);
    setNewStockCategory(stockCategories[0]?.id ?? "");
    setNewStockUnit("pcs");
    setNewStockLowThreshold(5);
    setOpen(true);
  }

  function openEdit(item: MenuItem) {
    setSubmitError(null);
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
      sizes: (item.sizes ?? []).map((s) => ({ ...s })),
    });

    const isDirect = item.stockMode === "DIRECT";
    setStockMode(isDirect ? "DIRECT" : "NONE");
    setStockItemId(item.stockItemId ?? (item as any).stockItem?.id ?? "");
    setIsCreatingNewStock(false);
    setNewStockCategory(stockCategories[0]?.id ?? "");
    setNewStockUnit("pcs");
    setNewStockLowThreshold(5);
    setOpen(true);
  }

  function updateSize(index: number, patch: Partial<{ name: string; price: number }>) {
    setForm((prev) => ({
      ...prev,
      sizes: (prev.sizes ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSizeRow() {
    setForm((prev) => ({
      ...prev,
      sizes: [...(prev.sizes ?? []), { name: "", price: prev.price > 0 ? prev.price : 0 }],
    }));
  }

  function removeSizeRow(index: number) {
    setForm((prev) => ({
      ...prev,
      sizes: (prev.sizes ?? []).filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setSubmitError("Item name is required.");
      return;
    }
    if (!form.categoryId) {
      setSubmitError("Please choose a category.");
      return;
    }
    if (!(form.price > 0)) {
      setSubmitError("Price must be greater than ₱0.");
      return;
    }
    const sizes = (form.sizes ?? [])
      .map((s) => ({ name: (s.name || "").trim(), price: Number(s.price) }));
    if (sizes.length > 20) {
      setSubmitError("Too many sizes (maximum 20).");
      return;
    }
    const seen = new Set<string>();
    for (const s of sizes) {
      if (!s.name) {
        setSubmitError("Each size needs a name (e.g. Small, Medium, Large).");
        return;
      }
      if (!(s.price > 0)) {
        setSubmitError(`Price for size "${s.name}" must be greater than ₱0.`);
        return;
      }
      const key = s.name.toLowerCase();
      if (seen.has(key)) {
        setSubmitError(`Duplicate size name "${s.name}".`);
        return;
      }
      seen.add(key);
    }

    const payload: any = { ...form, sizes, stockMode };

    if (stockMode === "DIRECT") {
      if (isCreatingNewStock) {
        payload.stockItemId = null;
        payload.createStockItem = {
          categoryId: newStockCategory || undefined,
          unit: newStockUnit.trim() || "pcs",
          lowStockThreshold: Math.max(0, Number(newStockLowThreshold) || 5),
        };
      } else if (stockItemId) {
        const alreadyLinkedTo = linkedStockMap.get(stockItemId);
        if (alreadyLinkedTo) {
          setSubmitError(`That stock item is already linked to "${alreadyLinkedTo}".`);
          return;
        }
        payload.stockItemId = stockItemId;
        payload.createStockItem = undefined;
      } else {
        payload.stockItemId = null;
        payload.createStockItem = {
          unit: "pcs",
          lowStockThreshold: 5,
        };
      }
    } else {
      payload.stockItemId = null;
      payload.createStockItem = undefined;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (editing) {
        await updateMenuItem(editing.id, payload);
      } else {
        await addMenuItem(payload);
      }
      setOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save menu item.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleArchive(item: MenuItem) {
    if (confirm(`Archive "${item.name}"? You can restore it from Archives.`)) {
      archiveMenuItem(item.id);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Menu"
        title="Menu Items"
        subtitle="Add, edit, and archive menu items available for your café."
      />

      <AdminPanel
        title="All Menu Items"
        subtitle={`${menuItems.length} item${menuItems.length === 1 ? "" : "s"} in menu`}
        action={
          <div className="flex items-center gap-2">
            {untrackedCount > 0 && (
              <button
                type="button"
                onClick={() => void handleSyncMenu()}
                disabled={syncingMenu}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingMenu ? "animate-spin text-amber-800" : ""}`} />
                {syncingMenu ? "Syncing..." : `Sync to Inventory (${untrackedCount})`}
              </button>
            )}
            <AdminButton onClick={openCreate}>+ Add Menu Item</AdminButton>
          </div>
        }
      >
        {untrackedCount > 0 && (
          <div className="mx-2 mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{untrackedCount} menu item{untrackedCount > 1 ? "s are" : " is"} currently untracked in inventory.</strong> Sync them so they appear in Stock In, Stock Adjustments, and Inventory History.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleSyncMenu()}
              disabled={syncingMenu}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold shrink-0 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingMenu ? "animate-spin" : ""}`} />
              {syncingMenu ? "Syncing to Inventory..." : "Sync All to Inventory"}
            </button>
          </div>
        )}
        <div className="relative px-2 pb-3">
          <Search className="absolute left-5 top-1/2 -translate-y-[calc(50%+6px)] w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            aria-label="Search menu items"
            className="w-full sm:max-w-xs pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/40 transition"
          />
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                    No menu items match your search.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const linkedStock =
                    (item as any).stockItem ??
                    (item.stockItemId
                      ? stockItems.find((s) => s.id === item.stockItemId)
                      : null);

                  return (
                    <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-stone-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#800000]">{item.name}</p>
                        <p className="mt-1 text-xs text-muted">{item.description}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {getMenuCategoryName(item.categoryId)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-accent">
                        ₱{item.price.toLocaleString()}
                        {(item.sizes ?? []).length > 0 && (
                          <span className="ml-1 text-[11px] font-medium text-stone-400">
                            · {(item.sizes ?? []).length} sizes
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.stockMode === "DIRECT" && linkedStock ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-stone-800 text-xs">
                                {Number(linkedStock.quantity).toFixed(2)} {linkedStock.unit}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  linkedStock.quantity <= 0
                                    ? "bg-red-100 text-red-800 ring-1 ring-red-200"
                                    : linkedStock.quantity <= (linkedStock.lowStockThreshold ?? 0)
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                                    : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                }`}
                              >
                                {linkedStock.quantity <= 0
                                  ? "Out of Stock"
                                  : linkedStock.quantity <= (linkedStock.lowStockThreshold ?? 0)
                                  ? "Low Stock"
                                  : "In Stock"}
                              </span>
                            </div>
                            <Link
                              href="/admin/inventory"
                              className="text-[11px] text-[#800000] hover:underline inline-flex items-center gap-1 font-medium mt-0.5"
                            >
                              <Link2 className="w-3 h-3" /> Tracked inventory →
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">— Untracked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.available
                              ? "bg-green-100 text-green-800 ring-1 ring-green-200"
                              : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                          }`}
                        >
                          {item.available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CrudActions
                          onEdit={() => openEdit(item)}
                          onDelete={() => handleArchive(item)}
                          deleteLabel="Archive"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminModal
        open={open}
        title={editing ? "Edit Menu Item" : "Add Menu Item"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editing ? "Save Changes" : "Add Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{submitError}</span>
            </div>
          )}
          <AdminField label="Item Name">
            <AdminInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="House Latte"
            />
          </AdminField>

          {/* Quick link suggestion if an existing stock item has matching name */}
          {matchingStockItem && stockMode === "NONE" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Found matching stock item <strong>{matchingStockItem.name}</strong> ({Number(matchingStockItem.quantity).toFixed(2)} {matchingStockItem.unit}).
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStockMode("DIRECT");
                  setStockItemId(matchingStockItem.id);
                  setIsCreatingNewStock(false);
                }}
                className="rounded-lg bg-amber-700 text-white font-medium px-2.5 py-1 text-xs hover:bg-amber-800 transition shrink-0"
              >
                Link Stock Item
              </button>
            </div>
          )}

          <AdminField label="Description">
            <AdminTextarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the item..."
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Price (₱)">
              <AdminInput
                type="number"
                min={1}
                value={form.price || ""}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </AdminField>
            <AdminField label="Category">
              <AdminSelect
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                {menuCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
          </div>
          <AdminField label="Availability">
            <AdminSelect
              value={form.available ? "available" : "unavailable"}
              onChange={(e) =>
                setForm({ ...form, available: e.target.value === "available" })
              }
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </AdminSelect>
          </AdminField>

          {/* ── Inventory Tracking Section ── */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">Inventory Tracking</p>
                <p className="text-[11px] text-stone-500">
                  Connect this menu item 1:1 with an inventory stock item to automatically track stock and prevent selling at zero stock.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStockMode("NONE")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition text-center ${
                  stockMode === "NONE"
                    ? "border-[#800000] bg-white text-[#800000] shadow-sm ring-1 ring-[#800000]"
                    : "border-stone-200 bg-white/50 text-stone-600 hover:bg-white"
                }`}
              >
                Not Tracked
              </button>
              <button
                type="button"
                onClick={() => setStockMode("DIRECT")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition text-center ${
                  stockMode === "DIRECT"
                    ? "border-[#800000] bg-white text-[#800000] shadow-sm ring-1 ring-[#800000]"
                    : "border-stone-200 bg-white/50 text-stone-600 hover:bg-white"
                }`}
              >
                Track Directly (1:1)
              </button>
            </div>

            {stockMode === "DIRECT" && (
              <div className="pt-2 space-y-3 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-700">Stock Item Source</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewStock(!isCreatingNewStock)}
                    className="text-xs text-[#800000] font-semibold hover:underline flex items-center gap-1"
                  >
                    {isCreatingNewStock ? (
                      <>
                        <Link2 className="w-3.5 h-3.5" /> Select existing stock item
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5" /> + Create new stock item
                      </>
                    )}
                  </button>
                </div>

                {!isCreatingNewStock ? (
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Link Existing Stock Item
                    </label>
                    <AdminSelect
                      value={stockItemId}
                      onChange={(e) => setStockItemId(e.target.value)}
                    >
                      <option value="">-- Choose stock item to link --</option>
                      {stockItems.map((s) => {
                        const linkedTo = linkedStockMap.get(s.id);
                        return (
                          <option key={s.id} value={s.id} disabled={Boolean(linkedTo)}>
                            {s.name} ({Number(s.quantity).toFixed(2)} {s.unit})
                            {linkedTo ? ` — Linked to "${linkedTo}"` : ""}
                          </option>
                        );
                      })}
                    </AdminSelect>
                    {editing && editing.stockMode === "DIRECT" && (
                      <p className="mt-1 text-[11px] text-stone-500">
                        Renaming this menu item automatically keeps the linked inventory item name synchronized.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-3">
                    <p className="text-xs font-semibold text-stone-800">
                      New Stock Item: &quot;{form.name || "Item name above"}&quot;
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Stock Category
                        </label>
                        <AdminSelect
                          value={newStockCategory}
                          onChange={(e) => setNewStockCategory(e.target.value)}
                        >
                          {stockCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </AdminSelect>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Unit (e.g. pcs, pack)
                        </label>
                        <AdminInput
                          value={newStockUnit}
                          onChange={(e) => setNewStockUnit(e.target.value)}
                          placeholder="pcs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Low Stock Threshold
                        </label>
                        <AdminInput
                          type="number"
                          min={0}
                          value={newStockLowThreshold}
                          onChange={(e) => setNewStockLowThreshold(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-700">Sizes</p>
              <button
                type="button"
                onClick={addSizeRow}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:border-[#800000] hover:text-[#800000]"
              >
                + Add Size
              </button>
            </div>
            <p className="mb-3 text-[11px] text-stone-500">
              Optional. Each size has its own price (e.g. Small ₱100, Medium
              ₱120). The base price above applies when no size is chosen.
              Leave empty for a single-price item.
            </p>
            {(form.sizes ?? []).length === 0 ? (
              <p className="text-xs text-stone-400">No sizes — item uses the base price.</p>
            ) : (
              <div className="space-y-2">
                {(form.sizes ?? []).map((size, index) => (
                  <div key={index} className="grid grid-cols-[1fr_110px_32px] items-center gap-2">
                    <AdminInput
                      value={size.name}
                      onChange={(e) => updateSize(index, { name: e.target.value })}
                      placeholder="e.g. Small"
                    />
                    <AdminInput
                      type="number"
                      min={1}
                      value={size.price || ""}
                      onChange={(e) => updateSize(index, { price: Number(e.target.value) })}
                      placeholder="₱"
                    />
                    <button
                      type="button"
                      onClick={() => removeSizeRow(index)}
                      aria-label={`Remove size ${size.name || index + 1}`}
                      className="flex h-9 w-8 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-400 hover:border-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminModal>
    </>
  );
}
