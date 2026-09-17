"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
import { MenuCustomizationForm } from "@/components/admin/MenuCustomizationForm";
import { useAdminData } from "@/context/AdminDataContext";
import type { MenuItem, MenuItemInput, StockItem } from "@/lib/admin/types";
import {
  Search,
  Plus,
  Edit2,
  Archive,
  Eye,
  EyeOff,
  Package,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
} from "lucide-react";

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm: MenuItemInput & { allergenInput?: string; stockItemId?: string } = {
  name: "",
  description: "",
  price: 0,
  categoryId: "",
  available: true,
  image: "",
  calories: "",
  allergens: [],
  spiceLevel: "None",
  servingSize: "",
  stockItemId: "",
  allergenInput: "",
  customizations: {
    enabled: false,
    enableSpecialInstructions: true,
  },
};

export default function MenuItemsPage() {
  const {
    menuItems: allMenuItems,
    getActiveMenuItems,
    getActiveMenuCategories,
    stockItems,
    addMenuItem,
    updateMenuItem,
    archiveMenuItem,
    restoreMenuItem,
    getMenuCategoryName,
  } = useAdminData();

  const menuCategories = getActiveMenuCategories();

  // Control Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] = useState("All");

  // Modals & Form State
  const [openModal, setOpenModal] = useState(false);
  const [modalTab, setModalTab] = useState<"details" | "customizations">("details");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemInput & { allergenInput?: string; stockItemId?: string }>(emptyForm);
  const [archiveConfirmItem, setArchiveConfirmItem] = useState<MenuItem | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      // Validate file
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new Error("File exceeds 5MB limit");
      }
      
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Unsupported file type. Use JPG, PNG, or WEBP.");
      }

      // Quick preview
      const objectUrl = URL.createObjectURL(file);
      setForm({ ...form, image: objectUrl }); // Optimistic preview

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      setForm((prev) => ({ ...prev, image: data.url }));
    } catch (err: any) {
      setUploadError(err.message);
      // Revert optimistic preview if failed
      if (form.image && form.image.startsWith('blob:')) {
         setForm((prev) => ({ ...prev, image: "" }));
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate stock status for each menu item based on linked or fuzzy-matched stock items
  const getItemStockInfo = (item: MenuItem) => {
    let linkedStock: StockItem | undefined;

    if (item.stockItemId) {
      linkedStock = stockItems.find((s) => s.id === item.stockItemId);
    }

    if (!linkedStock) {
      // Fuzzy match by item name in stock list
      const itemNameLower = item.name.toLowerCase();
      linkedStock = stockItems.find((s) =>
        itemNameLower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(itemNameLower)
      );
    }

    if (!linkedStock) {
      return {
        stockStatus: "In Stock" as const,
        effectiveAvailable: item.available,
        stockQty: null,
      };
    }

    if (linkedStock.quantity <= 0) {
      return {
        stockStatus: "Out of Stock" as const,
        effectiveAvailable: false, // Automatically unavailable when Out of Stock
        stockQty: 0,
      };
    }

    if (linkedStock.quantity <= linkedStock.lowStockThreshold) {
      return {
        stockStatus: "Low Stock" as const,
        effectiveAvailable: item.available,
        stockQty: linkedStock.quantity,
      };
    }

    return {
      stockStatus: "In Stock" as const,
      effectiveAvailable: item.available,
      stockQty: linkedStock.quantity,
    };
  };

  // Process & Filtered Menu Items
  const displayedItems = useMemo(() => {
    let baseList = availabilityFilter === "Archived"
      ? allMenuItems.filter((i) => i.archived)
      : allMenuItems.filter((i) => !i.archived);

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      baseList = baseList.filter(
        (i) => i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query)
      );
    }

    // 2. Category Filter
    if (categoryFilter !== "All") {
      baseList = baseList.filter((i) => i.categoryId === categoryFilter);
    }

    // 3. Availability Filter
    if (availabilityFilter !== "All" && availabilityFilter !== "Archived") {
      baseList = baseList.filter((item) => {
        const { stockStatus, effectiveAvailable } = getItemStockInfo(item);

        if (availabilityFilter === "Available") return effectiveAvailable;
        if (availabilityFilter === "Unavailable") return !effectiveAvailable;
        if (availabilityFilter === "Low Stock") return stockStatus === "Low Stock";
        if (availabilityFilter === "Out of Stock") return stockStatus === "Out of Stock";
        return true;
      });
    }

    return baseList;
  }, [allMenuItems, searchQuery, categoryFilter, availabilityFilter, stockItems]);

  // Form Handlers
  function openCreateModal() {
    setEditingItem(null);
    setValidationError(null);
    setForm({
      ...emptyForm,
      categoryId: menuCategories[0]?.id ?? "",
      sizes: [],
    });
    setModalTab("details");
    setOpenModal(true);
  }

  function openEditModal(item: MenuItem) {
    setEditingItem(item);
    setValidationError(null);
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
      image: item.image || "",
      calories: item.calories || "",
      allergens: item.allergens || [],
      spiceLevel: item.spiceLevel || "None",
      servingSize: item.servingSize || "",
      stockItemId: item.stockItemId || "",
      allergenInput: (item.allergens || []).join(", "),
      customizations: item.customizations || emptyForm.customizations,
      sizes: item.sizes || [],
    });
    setModalTab("details");
    setOpenModal(true);
  }

  function handleToggleAvailability(item: MenuItem) {
    updateMenuItem(item.id, {
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: !item.available,
      image: item.image,
      customizations: item.customizations,
    });
  }

  
  function addSize() {
    setForm(prev => ({ ...prev, sizes: [...(prev.sizes || []), { name: "", price: prev.price || 0, available: true }] }));
  }
  function updateSize(index: number, field: "name" | "price" | "available", value: any) {
    const list = [...(form.sizes || [])];
    list[index] = { ...list[index], [field]: value };
    setForm({ ...form, sizes: list });
  }
  function removeSize(index: number) {
    const list = [...(form.sizes || [])];
    list.splice(index, 1);
    setForm({ ...form, sizes: list });
  }

  function handleSubmitForm() {
    if (!form.name.trim()) {
      setValidationError("Please enter a menu item name.");
      return;
    }
    if (!form.categoryId) {
      setValidationError("Please select a category.");
      return;
    }
    if (!form.price || form.price <= 0) {
      setValidationError("Please enter a valid price greater than ₱0.");
      return;
    }

    const parsedAllergens = form.allergenInput
      ? form.allergenInput.split(",").map((s) => s.trim()).filter(Boolean)
      : form.allergens || [];

    const payload: MenuItemInput & { stockItemId?: string } = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      categoryId: form.categoryId,
      available: form.available,
      image: form.image?.trim() || "",
      calories: form.calories?.trim() || "",
      allergens: parsedAllergens,
      spiceLevel: form.spiceLevel || "None",
      servingSize: form.servingSize?.trim() || "",
      stockItemId: form.stockItemId || undefined,
      customizations: form.customizations,
      sizes: form.sizes,
    };

    if (editingItem) {
      updateMenuItem(editingItem.id, payload);
    } else {
      addMenuItem(payload);
    }
    setOpenModal(false);
  }

  function handleConfirmArchive() {
    if (archiveConfirmItem) {
      archiveMenuItem(archiveConfirmItem.id);
      setArchiveConfirmItem(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Menu Management"
        title="Menu Items"
        subtitle="Manage product catalog, pricing, ingredient inventory linkage, and customer availability."
        action={
          <AdminButton onClick={openCreateModal} className="flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Menu Item
          </AdminButton>
        }
      />

      {/* 1. COMPACT CONTROL SECTION ABOVE TABLE */}
      <section className="admin-panel rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search menu items by name or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-stone-200 text-xs text-stone-800 font-medium placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/30 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters & Add Action */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-600 hidden sm:inline">Category:</span>
              <select
                className="px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                {menuCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-600 hidden sm:inline">Status:</span>
              <select
                className="px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="All">All Items</option>
                <option value="Available">Available</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Unavailable">Unavailable</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MENU ITEM TABLE (DESKTOP) & CARDS (MOBILE) */}
      <AdminPanel
        title={availabilityFilter === "Archived" ? "Archived Menu Items" : "Menu Catalog"}
        subtitle={`${displayedItems.length} menu item${displayedItems.length === 1 ? "" : "s"} found`}
      >
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto px-2 pb-2">
          <table className="w-full text-left text-xs align-middle">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-16">Image</th>
                <th className="py-3 px-4">Menu Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4">Customer Availability</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {displayedItems.map((item) => {
                const { stockStatus, effectiveAvailable } = getItemStockInfo(item);
                const categoryName = getMenuCategoryName(item.categoryId);

                return (
                  <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                    {/* Thumbnail Image */}
                    <td className="py-3 px-4">
                      <div className="h-11 w-11 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden relative flex items-center justify-center shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Utensils className="h-5 w-5 text-stone-400" />
                        )}
                      </div>
                    </td>

                    {/* Menu Item Name & Description */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#800000] text-sm">{item.name}</p>
                      <p className="text-stone-500 text-xs line-clamp-1 max-w-[260px] mt-0.5">
                        {item.description || "No description provided"}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-bold">
                        {categoryName}
                      </span>
                    </td>

                    {/* Price (Philippine Peso) */}
                    <td className="py-3 px-4 font-extrabold text-[#800000] text-sm">
                      {formatCurrency(item.price)}
                    </td>

                    {/* Stock Status Badge */}
                    <td className="py-3 px-4">
                      {stockStatus === "In Stock" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> In Stock
                        </span>
                      ) : stockStatus === "Low Stock" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                          <AlertTriangle className="h-3 w-3 text-amber-600" /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                          <XCircle className="h-3 w-3 text-rose-600" /> Out of Stock
                        </span>
                      )}
                    </td>

                    {/* Customer Availability */}
                    <td className="py-3 px-4">
                      {effectiveAvailable ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          🟢 Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                          🔴 Unavailable
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!item.archived ? (
                          <>
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit Item"
                              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-[#800000] transition cursor-pointer"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              title={item.available ? "Mark Unavailable" : "Mark Available"}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                item.available ? "text-emerald-700 hover:bg-emerald-50" : "text-rose-700 hover:bg-rose-50"
                              }`}
                            >
                              {item.available ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => setArchiveConfirmItem(item)}
                              title="Archive Item"
                              className="p-1.5 rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => restoreMenuItem(item.id)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-stone-500 font-medium">
                    No menu items found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW (320px–768px) */}
        <div className="md:hidden space-y-3 p-3">
          {displayedItems.map((item) => {
            const { stockStatus, effectiveAvailable } = getItemStockInfo(item);
            const categoryName = getMenuCategoryName(item.categoryId);

            return (
              <div key={item.id} className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden relative flex items-center justify-center shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Utensils className="h-6 w-6 text-stone-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-[#800000] text-sm leading-snug">{item.name}</p>
                      <p className="font-extrabold text-[#800000] text-sm ml-2">{formatCurrency(item.price)}</p>
                    </div>
                    <p className="text-stone-500 text-xs line-clamp-2 mt-0.5">{item.description}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold mt-1">
                      {categoryName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-2">
                    {stockStatus === "In Stock" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        In Stock
                      </span>
                    ) : stockStatus === "Low Stock" ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                        Out of Stock
                      </span>
                    )}

                    {effectiveAvailable ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        Available
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                        Unavailable
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!item.archived ? (
                      <>
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-3 py-1.5 bg-stone-100 text-stone-800 rounded-xl text-xs font-bold hover:bg-stone-200 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setArchiveConfirmItem(item)}
                          className="p-1.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => restoreMenuItem(item.id)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {displayedItems.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-xs text-stone-500 font-medium">
              No menu items match your filters.
            </div>
          )}
        </div>
      </AdminPanel>

      {/* 3. ADD / EDIT MENU ITEM MODAL */}
      <AdminModal
        open={openModal}
        title={editingItem ? "Edit Menu Item" : "Add New Menu Item"}
        onClose={() => setOpenModal(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpenModal(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmitForm}>
              {editingItem ? "Save Changes" : "Add Item"}
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

        <div className="flex gap-4 mb-4 border-b border-stone-200">
          <button
            onClick={() => setModalTab("details")}
            className={`pb-2 font-bold text-sm transition cursor-pointer ${
              modalTab === "details"
                ? "border-b-2 border-[#800000] text-[#800000]"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Basic Details &amp; Inventory
          </button>
          <button
            onClick={() => setModalTab("customizations")}
            className={`pb-2 font-bold text-sm transition cursor-pointer ${
              modalTab === "customizations"
                ? "border-b-2 border-[#800000] text-[#800000]"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Customizations
          </button>
        </div>

        {modalTab === "details" ? (
          <div className="space-y-4">
            <AdminField label="Menu Item Name">
              <AdminInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. House Special Latte"
              />
            </AdminField>

            <AdminField label="Description">
              <AdminTextarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Rich espresso brewed with steamed milk and Madagascar vanilla..."
              />
            </AdminField>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Price (₱)">
                <AdminInput
                  type="number"
                  min={1}
                  step={0.5}
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  placeholder="145.00"
                />
              </AdminField>

              <AdminField label="Category">
                <AdminSelect
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  {menuCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
            </div>

            {/* Inventory Stock Item Linkage */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <p className="text-xs font-bold text-[#800000] flex items-center gap-1.5">
                <Package className="h-4 w-4 text-[#800000]" /> Linked Inventory Ingredient
              </p>
              <p className="text-[11px] text-stone-500">
                Link this menu item to an ingredient in inventory. When ingredient stock hits 0, item automatically turns Unavailable.
              </p>
              <AdminSelect
                value={form.stockItemId || ""}
                onChange={(e) => setForm({ ...form, stockItemId: e.target.value })}
              >
                <option value="">Auto-match by name / None</option>
                {stockItems.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.quantity} {st.unit} available)
                  </option>
                ))}
              </AdminSelect>
            </div>

            <AdminField label="Menu Item Image">
              <div className="mt-1 space-y-3">
                {uploadError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {uploadError}
                  </div>
                )}
                
                {form.image ? (
                  <div className="relative group rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                    <img
                      src={form.image}
                      alt="Menu item preview"
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Invalid+Image';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="cursor-pointer bg-white text-stone-900 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-stone-100 transition flex items-center gap-2">
                        <UploadCloud className="h-4 w-4" />
                        Change Image
                        <input
                          type="file"
                          accept="image/jpeg, image/png, image/webp"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-rose-700 transition flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-50 hover:bg-stone-100 hover:border-stone-400 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 mb-3 text-stone-400" />
                      <p className="mb-2 text-sm font-semibold text-stone-700">
                        {isUploading ? "Uploading..." : "Click to Upload Image"}
                      </p>
                      <p className="text-xs text-stone-500">JPG, PNG, or WEBP • Max 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg, image/png, image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </AdminField>

            {/* Nutrition & Allergen Details */}
            <div className="pt-2 border-t border-stone-200">
              <p className="text-xs font-bold text-[#800000] mb-2">Nutrition &amp; Allergen Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Calories (kcal)">
                  <AdminInput
                    value={form.calories || ""}
                    onChange={(e) => setForm({ ...form, calories: e.target.value })}
                    placeholder="e.g. 180 kcal"
                  />
                </AdminField>
                <AdminField label="Serving Size">
                  <AdminInput
                    value={form.servingSize || ""}
                    onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
                    placeholder="e.g. 16 oz or 350g"
                  />
                </AdminField>
                <AdminField label="Spice Level">
                  <AdminSelect
                    value={form.spiceLevel || "None"}
                    onChange={(e) => setForm({ ...form, spiceLevel: e.target.value })}
                  >
                    <option value="None">None</option>
                    <option value="Mild">Mild 🌶️</option>
                    <option value="Medium">Medium 🌶️🌶️</option>
                    <option value="Hot">Hot 🌶️🌶️🌶️</option>
                  </AdminSelect>
                </AdminField>
                <AdminField label="Allergens (Comma-separated)">
                  <AdminInput
                    value={form.allergenInput ?? ""}
                    onChange={(e) => setForm({ ...form, allergenInput: e.target.value })}
                    placeholder="e.g. Dairy, Nuts, Soy"
                  />
                </AdminField>
              </div>
            </div>

            <AdminField label="Customer Ordering Availability">
              <AdminSelect
                value={form.available ? "available" : "unavailable"}
                onChange={(e) => setForm({ ...form, available: e.target.value === "available" })}
              >
                <option value="available">Available for Customer Ordering</option>
                <option value="unavailable">Unavailable (Disabled)</option>
              </AdminSelect>
            </AdminField>
          </div>
        ) : (
          <MenuCustomizationForm
            config={form.customizations!}
            onChange={(config) => setForm({ ...form, customizations: config })}
          />
        )}
      </AdminModal>

      {/* 4. ARCHIVE CONFIRMATION MODAL */}
      {archiveConfirmItem && (
        <AdminModal
          open={Boolean(archiveConfirmItem)}
          title="Archive Menu Item"
          onClose={() => setArchiveConfirmItem(null)}
          footer={
            <>
              <AdminButton variant="secondary" onClick={() => setArchiveConfirmItem(null)}>
                Cancel
              </AdminButton>
              <button
                onClick={handleConfirmArchive}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition"
              >
                Archive Item
              </button>
            </>
          }
        >
          <div className="py-2 text-stone-700 text-xs font-medium space-y-2">
            <p>
              Are you sure you want to archive <strong className="text-[#800000]">{archiveConfirmItem.name}</strong>?
            </p>
            <p className="text-stone-500">
              It will be hidden from the active menu list and customer portal, but can be restored anytime from the Archived filter.
            </p>
          </div>
        </AdminModal>
      )}
    </>
  );
}
