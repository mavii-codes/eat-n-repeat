"use client";

import { useState } from "react";
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
    addMenuItem,
    updateMenuItem,
    archiveMenuItem,
    getMenuCategoryName,
  } = useAdminData();

  const menuItems = getActiveMenuItems();
  const menuCategories = getActiveMenuCategories();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemInput>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openCreate() {
    setSubmitError(null);
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: menuCategories[0]?.id ?? "",
    });
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

  function handleSubmit() {
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
    // Validate sizes: names required + unique, prices positive. Empty list
    // is fine — the item then works as a normal single-price item.
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
    setSubmitError(null);

    const payload = { ...form, sizes };

    if (editing) {
      updateMenuItem(editing.id, payload);
    } else {
      addMenuItem(payload);
    }
    setOpen(false);
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
        action={<AdminButton onClick={openCreate}>+ Add Menu Item</AdminButton>}
      >
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => (
                <tr key={item.id} className="border-b border-accent/5 last:border-0">
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
              ))}
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
            <AdminButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editing ? "Save Changes" : "Add Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
              {submitError}
            </div>
          )}
          <AdminField label="Item Name">
            <AdminInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="House Latte"
            />
          </AdminField>
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
