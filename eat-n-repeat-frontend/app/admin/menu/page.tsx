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

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: menuCategories[0]?.id ?? "",
    });
    setOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.categoryId || form.price <= 0) return;

    if (editing) {
      updateMenuItem(editing.id, form);
    } else {
      addMenuItem(form);
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
        </div>
      </AdminModal>
    </>
  );
}
