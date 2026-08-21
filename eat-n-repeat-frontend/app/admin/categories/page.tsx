"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { MenuCategory, MenuCategoryInput, MenuItem } from "@/lib/admin/types";
import {
  Plus,
  Edit2,
  Archive,
  Eye,
  FolderPlus,
  Utensils,
  XCircle,
  RotateCcw,
  Tag,
  CheckCircle2,
} from "lucide-react";

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm: MenuCategoryInput = {
  name: "",
  description: "",
};

export default function CategoriesPage() {
  const {
    menuCategories: allCategories,
    getActiveMenuCategories,
    addMenuCategory,
    updateMenuCategory,
    archiveMenuCategory,
    restoreMenuCategory,
    getMenuItemsByCategory,
  } = useAdminData();

  // Tab & Modal State
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [openModal, setOpenModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [form, setForm] = useState<MenuCategoryInput>(emptyForm);
  const [validationError, setValidationError] = useState<string | null>(null);

  // View Items Modal State
  const [viewingCategory, setViewingCategory] = useState<MenuCategory | null>(null);

  // Archive Confirmation Modal State
  const [archiveConfirmCategory, setArchiveConfirmCategory] = useState<MenuCategory | null>(null);

  // Filter categories by active / archived tab
  const displayedCategories = useMemo(() => {
    return allCategories.filter((c) => (activeTab === "active" ? !c.archived : c.archived));
  }, [allCategories, activeTab]);

  // Items inside currently viewed category
  const viewedCategoryItems = useMemo<MenuItem[]>(() => {
    if (!viewingCategory) return [];
    return getMenuItemsByCategory(viewingCategory.id);
  }, [viewingCategory, getMenuItemsByCategory]);

  // Form Handlers
  function openCreateModal() {
    setEditingCategory(null);
    setValidationError(null);
    setForm(emptyForm);
    setOpenModal(true);
  }

  function openEditModal(category: MenuCategory) {
    setEditingCategory(category);
    setValidationError(null);
    setForm({ name: category.name, description: category.description });
    setOpenModal(true);
  }

  function handleSubmitForm() {
    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setValidationError("Please enter a category name.");
      return;
    }

    // Duplicate Category Name Check
    const duplicate = allCategories.find(
      (c) =>
        c.name.toLowerCase() === trimmedName.toLowerCase() &&
        (!editingCategory || c.id !== editingCategory.id) &&
        !c.archived
    );

    if (duplicate) {
      setValidationError(`A category named "${trimmedName}" already exists. Please choose a unique name.`);
      return;
    }

    if (editingCategory) {
      updateMenuCategory(editingCategory.id, {
        name: trimmedName,
        description: form.description.trim(),
      });
    } else {
      addMenuCategory({
        name: trimmedName,
        description: form.description.trim(),
      });
    }

    setOpenModal(false);
  }

  function handleConfirmArchive() {
    if (archiveConfirmCategory) {
      archiveMenuCategory(archiveConfirmCategory.id);
      setArchiveConfirmCategory(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Categories"
        title="Menu Categories"
        subtitle="Organize your menu catalog into customer-facing categories."
        action={
          <AdminButton onClick={openCreateModal} className="flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Category
          </AdminButton>
        }
      />

      {/* 1. TAB SELECTOR FOR ACTIVE VS ARCHIVED CATEGORIES */}
      <div className="admin-panel rounded-2xl p-4 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-[#800000] text-white shadow-sm"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            Active Categories ({allCategories.filter((c) => !c.archived).length})
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "archived"
                ? "bg-[#800000] text-white shadow-sm"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            Archived Categories ({allCategories.filter((c) => c.archived).length})
          </button>
        </div>

        <p className="text-xs text-muted font-medium">
          Active categories automatically appear on customer ordering menus.
        </p>
      </div>

      {/* 2. CATEGORY CARDS GRID */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {displayedCategories.map((category) => {
          const categoryItems = getMenuItemsByCategory(category.id);
          const itemCount = categoryItems.length;

          return (
            <div
              key={category.id}
              className="admin-panel rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-[#800000]/30"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-[#fff0f2] flex items-center justify-center text-[#800000] shrink-0">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#800000] leading-snug">
                        {category.name}
                      </h3>
                      <p className="text-xs font-bold text-stone-500">
                        {itemCount} menu item{itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  {!category.archived ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold border border-stone-200 shrink-0">
                      Archived
                    </span>
                  )}
                </div>

                <p className="text-stone-600 text-xs leading-relaxed line-clamp-2 mb-4">
                  {category.description || "No description provided for this category."}
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setViewingCategory(category)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-800 rounded-xl text-xs font-bold hover:bg-stone-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" /> View Items
                </button>

                <div className="flex items-center gap-1.5">
                  {!category.archived ? (
                    <>
                      <button
                        onClick={() => openEditModal(category)}
                        className="p-1.5 text-stone-600 hover:bg-stone-100 hover:text-[#800000] rounded-lg transition cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setArchiveConfirmCategory(category)}
                        className="p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                        title="Archive Category"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => restoreMenuCategory(category.id)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {displayedCategories.length === 0 && (
          <div className="col-span-full admin-panel rounded-2xl p-10 text-center text-stone-500 font-medium">
            <FolderPlus className="h-10 w-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-stone-700">No {activeTab} categories found</p>
            <p className="text-xs text-stone-400 mt-1">
              {activeTab === "active"
                ? "Click + Add Category to create your first menu category."
                : "Archived categories will appear here."}
            </p>
          </div>
        )}
      </section>

      {/* 3. ADD / EDIT CATEGORY MODAL */}
      <AdminModal
        open={openModal}
        title={editingCategory ? "Edit Menu Category" : "Add New Category"}
        onClose={() => setOpenModal(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpenModal(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmitForm}>
              {editingCategory ? "Save Changes" : "Add Category"}
            </AdminButton>
          </>
        }
      >
        {validationError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            {validationError}
          </div>
        )}

        <div className="space-y-4">
          <AdminField label="Category Name">
            <AdminInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Coffee & Espresso"
            />
          </AdminField>

          <AdminField label="Description (Optional)">
            <AdminTextarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Freshly brewed coffee drinks, lattes, and specialty roasts..."
            />
          </AdminField>
        </div>
      </AdminModal>

      {/* 4. VIEW ITEMS MODAL */}
      {viewingCategory && (
        <AdminModal
          open={Boolean(viewingCategory)}
          title={`Category Items: ${viewingCategory.name}`}
          onClose={() => setViewingCategory(null)}
          footer={
            <AdminButton variant="secondary" onClick={() => setViewingCategory(null)}>
              Close
            </AdminButton>
          }
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <p className="text-xs text-muted font-medium">
                {viewedCategoryItems.length} menu item{viewedCategoryItems.length === 1 ? "" : "s"} assigned to this category
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {viewedCategoryItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-[#800000]">{item.name}</p>
                    <p className="text-[10px] text-stone-500 line-clamp-1">{item.description || "No description"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <p className="font-extrabold text-[#800000]">{formatCurrency(item.price)}</p>
                    {item.available ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        Available
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {viewedCategoryItems.length === 0 && (
                <div className="p-6 text-center text-xs text-stone-500 font-medium bg-stone-50 rounded-xl">
                  No menu items are currently assigned to this category.
                </div>
              )}
            </div>
          </div>
        </AdminModal>
      )}

      {/* 5. DATA SAFETY ARCHIVE CONFIRMATION MODAL */}
      {archiveConfirmCategory && (
        <AdminModal
          open={Boolean(archiveConfirmCategory)}
          title={`Archive Category: ${archiveConfirmCategory.name}`}
          onClose={() => setArchiveConfirmCategory(null)}
          footer={
            <>
              <AdminButton variant="secondary" onClick={() => setArchiveConfirmCategory(null)}>
                Cancel
              </AdminButton>
              <button
                onClick={handleConfirmArchive}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition cursor-pointer"
              >
                Archive Category
              </button>
            </>
          }
        >
          <div className="py-2 text-stone-700 text-xs font-medium space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold flex items-start gap-2">
              <Utensils className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                This category currently contains{" "}
                <span className="underline decoration-amber-500 font-black">
                  {getMenuItemsByCategory(archiveConfirmCategory.id).length} menu item(s)
                </span>.
              </div>
            </div>

            <p>
              Archiving <strong className="text-[#800000]">{archiveConfirmCategory.name}</strong> will hide it from customer menu tabs, but <strong className="text-emerald-800">all menu items will remain safely stored</strong> in your catalog.
            </p>

            <p className="text-stone-500">
              Would you like to proceed with archiving this category?
            </p>
          </div>
        </AdminModal>
      )}
    </>
  );
}
