"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminTextarea,
  CrudActions,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { MenuCategory, MenuCategoryInput } from "@/lib/admin/types";

const emptyForm: MenuCategoryInput = {
  name: "",
  description: "",
};

export default function CategoriesPage() {
  const {
    getActiveMenuCategories,
    addMenuCategory,
    updateMenuCategory,
    archiveMenuCategory,
    getMenuItemsByCategory,
  } = useAdminData();

  const menuCategories = getActiveMenuCategories();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [form, setForm] = useState<MenuCategoryInput>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(category: MenuCategory) {
    setEditing(category);
    setForm({ name: category.name, description: category.description });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;

    if (editing) {
      updateMenuCategory(editing.id, form);
    } else {
      addMenuCategory(form);
    }
    setOpen(false);
  }

  function handleArchive(category: MenuCategory) {
    const itemCount = getMenuItemsByCategory(category.id).length;
    if (itemCount > 0) {
      alert(
        `Cannot archive "${category.name}" — ${itemCount} active menu item(s) still use this category.`,
      );
      return;
    }

    if (confirm(`Archive category "${category.name}"?`)) {
      archiveMenuCategory(category.id);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Categories"
        title="Menu Categories"
        subtitle="Organize your menu by adding, editing, or archiving categories."
      />

      <AdminPanel
        title="All Categories"
        subtitle={`${menuCategories.length} categor${menuCategories.length === 1 ? "y" : "ies"}`}
        action={<AdminButton onClick={openCreate}>+ Add Category</AdminButton>}
      >
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {menuCategories.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-accent/5 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[#800000]">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 text-muted">{category.description}</td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {getMenuItemsByCategory(category.id).length}
                  </td>
                  <td className="px-4 py-3">
                    <CrudActions
                      onEdit={() => openEdit(category)}
                      onDelete={() => handleArchive(category)}
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
        title={editing ? "Edit Category" : "Add Category"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editing ? "Save Changes" : "Add Category"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Category Name">
            <AdminInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coffee"
            />
          </AdminField>
          <AdminField label="Description">
            <AdminTextarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Describe this category..."
            />
          </AdminField>
        </div>
      </AdminModal>
    </>
  );
}
