"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  CrudActions,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { StockCategory, StockCategoryInput, StockItem, StockItemInput } from "@/lib/admin/types";

const emptyStockForm: StockItemInput = {
  name: "",
  categoryId: "",
  quantity: 0,
  unit: "",
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
    deleteStockItem,
    addStockCategory,
    updateStockCategory,
    deleteStockCategory,
    getStockCategoryName,
    getStockItemsByCategory,
  } = useAdminData();

  const [filterCategory, setFilterCategory] = useState("all");
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
  const [stockForm, setStockForm] = useState<StockItemInput>(emptyStockForm);
  const [categoryForm, setCategoryForm] = useState<StockCategoryInput>(emptyCategoryForm);

  const lowStockCount = stockItems.filter(
    (item) => item.quantity <= item.lowStockThreshold,
  ).length;

  const filteredItems = useMemo(() => {
    if (filterCategory === "all") return stockItems;
    return stockItems.filter((item) => item.categoryId === filterCategory);
  }, [stockItems, filterCategory]);

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
      updateStockItem(editingStock.id, stockForm);
    } else {
      addStockItem(stockForm);
    }
    setStockModalOpen(false);
  }

  function handleStockDelete(item: StockItem) {
    if (confirm(`Delete stock item "${item.name}"?`)) {
      deleteStockItem(item.id);
    }
  }

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
      alert(
        `Cannot delete "${category.name}" — ${itemCount} stock item(s) still use this category.`,
      );
      return;
    }

    if (confirm(`Delete stock category "${category.name}"?`)) {
      deleteStockCategory(category.id);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Inventory"
        title="Stock Management"
        subtitle="Manage inventory items, stock categories, and low-stock alerts."
      />

      <section className="grid gap-5 sm:grid-cols-3">
        {[
          { label: "Total Items", value: stockItems.length },
          { label: "Categories", value: stockCategories.length },
          { label: "Low Stock Alerts", value: lowStockCount },
        ].map((stat) => (
          <div key={stat.label} className="admin-stat-card rounded-2xl p-5 pl-6">
            <p className="text-sm font-medium text-muted">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <AdminPanel
          title="Inventory List"
          subtitle="Add, edit, and delete stock items"
          action={
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="secondary" onClick={openCreateCategory}>
                + Category
              </AdminButton>
              <AdminButton onClick={openCreateStock}>+ Add Stock</AdminButton>
            </div>
          }
        >
          <div className="border-b border-accent/10 px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterCategory("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filterCategory === "all"
                    ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                    : "bg-accent-light text-accent"
                }`}
              >
                All
              </button>
              {stockCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setFilterCategory(category.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    filterCategory === category.id
                      ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                      : "bg-accent-light text-accent"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="admin-table-head text-muted">
                  <th className="rounded-l-lg px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLowStock = item.quantity <= item.lowStockThreshold;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-accent/5 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-[#800000]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {getStockCategoryName(item.categoryId)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-accent">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-muted">{item.unit}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isLowStock
                              ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                              : "bg-green-100 text-green-800 ring-1 ring-green-200"
                          }`}
                        >
                          {isLowStock ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CrudActions
                          onEdit={() => openEditStock(item)}
                          onDelete={() => handleStockDelete(item)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        <AdminPanel title="Stock Categories" subtitle="Inventory groupings">
          <div className="space-y-3 px-4 py-4">
            {stockCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent-light/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[#800000]">{category.name}</p>
                  <p className="text-xs text-muted">
                    {getStockItemsByCategory(category.id).length} items
                  </p>
                </div>
                <CrudActions
                  onEdit={() => openEditCategory(category)}
                  onDelete={() => handleCategoryDelete(category)}
                />
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        open={stockModalOpen}
        title={editingStock ? "Edit Stock Item" : "Add Stock Item"}
        onClose={() => setStockModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setStockModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleStockSubmit}>
              {editingStock ? "Save Changes" : "Add Stock"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Item Name">
            <AdminInput
              value={stockForm.name}
              onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
            />
          </AdminField>
          <AdminField label="Category">
            <AdminSelect
              value={stockForm.categoryId}
              onChange={(e) =>
                setStockForm({ ...stockForm, categoryId: e.target.value })
              }
            >
              {stockCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField label="Quantity">
              <AdminInput
                type="number"
                min={0}
                value={stockForm.quantity || ""}
                onChange={(e) =>
                  setStockForm({ ...stockForm, quantity: Number(e.target.value) })
                }
              />
            </AdminField>
            <AdminField label="Unit">
              <AdminInput
                value={stockForm.unit}
                onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                placeholder="kg, L, cans"
              />
            </AdminField>
            <AdminField label="Low Stock At">
              <AdminInput
                type="number"
                min={1}
                value={stockForm.lowStockThreshold || ""}
                onChange={(e) =>
                  setStockForm({
                    ...stockForm,
                    lowStockThreshold: Number(e.target.value),
                  })
                }
              />
            </AdminField>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={categoryModalOpen}
        title={editingCategory ? "Edit Stock Category" : "Add Stock Category"}
        onClose={() => setCategoryModalOpen(false)}
        footer={
          <>
            <AdminButton
              variant="secondary"
              onClick={() => setCategoryModalOpen(false)}
            >
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
            placeholder="Dairy"
          />
        </AdminField>
      </AdminModal>
    </>
  );
}
