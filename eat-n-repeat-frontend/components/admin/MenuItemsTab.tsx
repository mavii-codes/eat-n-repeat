"use client";

import { useState, useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { 
  AdminPanel, 
  AdminButton, 
  AdminField, 
  AdminInput, 
  AdminTextarea, 
  AdminSelect 
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import type { MenuItem } from "@/lib/admin/types";
import { 
  Search, 
  Coffee, 
  Image as ImageIcon,
  MoreVertical,
  Edit2,
  Archive,
  Check,
  X
} from "lucide-react";

export function MenuItemsTab() {
  const { 
    menuItems, 
    menuCategories, 
    addMenuItem, 
    updateMenuItem, 
    archiveMenuItem 
  } = useAdminData();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  const [formState, setFormState] = useState<{
    name: string;
    description: string;
    categoryId: string;
    price: number | string;
    image: string;
    available: boolean;
  }>({
    name: "",
    description: "",
    categoryId: "",
    price: 0,
    image: "",
    available: true
  });

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const activeMenuItems = useMemo(() => {
    return menuItems.filter(m => !m.archived);
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return activeMenuItems.filter(item => {
      if (selectedCategoryId !== "all" && item.categoryId !== selectedCategoryId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(term) && !item.description.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [activeMenuItems, searchTerm, selectedCategoryId]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormState({
      name: "",
      description: "",
      categoryId: menuCategories[0]?.id || "",
      price: 0,
      image: "",
      available: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormState({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      price: item.price,
      image: item.image || "",
      available: item.available
    });
    setIsModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleArchive = (id: string) => {
    if (confirm("Are you sure you want to archive this menu item? It will be hidden from the menu.")) {
      archiveMenuItem(id);
    }
    setActiveDropdownId(null);
  };

  const handleSubmit = () => {
    if (!formState.name || !formState.categoryId || Number(formState.price) <= 0) {
      alert("Please fill in all required fields (Name, Category, Price > 0).");
      return;
    }

    if (editingItem) {
      updateMenuItem(editingItem.id, {
        name: formState.name,
        description: formState.description,
        categoryId: formState.categoryId,
        price: Number(formState.price),
        image: formState.image,
        available: formState.available
      });
    } else {
      addMenuItem({
        name: formState.name,
        description: formState.description,
        categoryId: formState.categoryId,
        price: Number(formState.price),
        image: formState.image,
        available: formState.available
      });
    }
    setIsModalOpen(false);
  };

  const getCategoryName = (id: string) => {
    return menuCategories.find(c => c.id === id)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#5A1824] border border-[#5A1824]/10">Menu</span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#5A1824] mt-1.5">Menu Management</h1>
          <p className="text-sm text-[#817875] mt-1">Add, edit, or adjust the café items.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <AdminButton onClick={openAddModal}>+ Add Menu Item</AdminButton>
           <p className="text-[10px] font-bold uppercase tracking-widest text-[#817875]">{activeMenuItems.length} menu items</p>
        </div>
      </div>

      <AdminPanel title="Café Menu Catalog" subtitle="Manage item details and availability">
        
        {/* SEARCH & FILTERS */}
        <div className="p-4 border-b border-[#5A1824]/10 bg-white/40 backdrop-blur-md space-y-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#817875]" />
            <input 
              type="text" 
              placeholder="Search menu items..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm bg-white/80 border border-[#5A1824]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A1824]/30 w-full transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedCategoryId("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${selectedCategoryId === "all" ? "bg-[#5A1824] text-white shadow-md" : "bg-white/80 text-[#817875] border border-[#5A1824]/10 hover:bg-stone-100"}`}
            >
              All Items
            </button>
            {menuCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${selectedCategoryId === cat.id ? "bg-[#5A1824] text-white shadow-md" : "bg-white/80 text-[#817875] border border-[#5A1824]/10 hover:bg-stone-100"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto bg-white/60 backdrop-blur-md">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-stone-50/50 text-[#817875] text-[11px] uppercase tracking-wider border-b border-[#5A1824]/10">
                <th className="px-6 py-4 font-bold">Item</th>
                <th className="px-4 py-4 font-bold">Category</th>
                <th className="px-4 py-4 font-bold">Price</th>
                <th className="px-4 py-4 font-bold">Availability</th>
                <th className="px-4 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#5A1824]/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#817875]">No menu items found.</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-white/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-[#5A1824]/10 shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                        ) : null}
                        <div className={`w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 ${item.image ? 'hidden' : ''}`}>
                           <Coffee className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#5A1824] text-base">{item.name}</h3>
                          <p className="text-xs text-[#817875] truncate max-w-[200px] mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex bg-stone-100 border border-stone-200 text-[#817875] px-2.5 py-1 rounded-lg text-xs font-semibold">
                        {getCategoryName(item.categoryId)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black text-[#2B2523]">₱{item.price}</td>
                    <td className="px-4 py-4">
                      {item.available ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-stone-500 border border-stone-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                          Unavailable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                       <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActiveDropdownId(activeDropdownId === item.id ? null : item.id)}
                            className="p-1.5 text-stone-400 hover:bg-stone-100 hover:text-[#5A1824] rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {activeDropdownId === item.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveDropdownId(null)}></div>
                              <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-stone-200 z-20 overflow-hidden">
                                <button onClick={() => openEditModal(item)} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#2B2523] hover:bg-stone-50 flex items-center gap-2">
                                  <Edit2 className="w-4 h-4" /> Edit
                                </button>
                                <button onClick={() => handleArchive(item.id)} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100">
                                  <Archive className="w-4 h-4" /> Archive
                                </button>
                              </div>
                            </>
                          )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden divide-y divide-[#5A1824]/5 bg-white/40 backdrop-blur-md">
          {filteredItems.length === 0 ? (
             <div className="py-12 text-center text-[#817875] text-sm">No menu items found.</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="p-4 hover:bg-white/50 transition-colors">
                <div className="flex gap-4">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-20 h-20 rounded-2xl object-cover border border-[#5A1824]/10 shadow-sm shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                  ) : null}
                  <div className={`w-20 h-20 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0 ${item.image ? 'hidden' : ''}`}>
                     <Coffee className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-[#5A1824] text-lg truncate">{item.name}</h3>
                      <button onClick={() => openEditModal(item)} className="text-[#5A1824] bg-[#5A1824]/5 hover:bg-[#5A1824]/10 p-1.5 rounded-lg shrink-0">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-[#817875] font-semibold mt-1 mb-2">{getCategoryName(item.categoryId)}</p>
                    <div className="flex justify-between items-center mt-2">
                       <p className="font-black text-[#2B2523] text-lg">₱{item.price}</p>
                       {item.available ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span> Unavailable
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminPanel>

      {/* ADD / EDIT MODAL */}
      <AdminModal
        open={isModalOpen}
        title={editingItem ? "Edit Menu Item" : "Add Menu Item"}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editingItem ? "Save Changes" : "Add Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Availability Toggle */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#2B2523] text-sm">Availability Status</p>
              <p className="text-xs text-[#817875] mt-0.5">Control if customers can order this item.</p>
            </div>
            <button
              type="button"
              onClick={() => setFormState(prev => ({ ...prev, available: !prev.available }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${formState.available ? 'bg-emerald-500' : 'bg-stone-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formState.available ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <AdminField label="Item Name">
            <AdminInput
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="e.g. Matcha Latte"
              required
            />
          </AdminField>
          
          <AdminField label="Description">
            <AdminTextarea
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              placeholder="e.g. Premium Uji matcha with perfectly steamed milk."
              rows={3}
            />
          </AdminField>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Category">
              <AdminSelect
                value={formState.categoryId}
                onChange={(e) => setFormState({ ...formState, categoryId: e.target.value })}
              >
                {menuCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            
            <AdminField label="Price (PHP)">
              <AdminInput
                type="number"
                min={1}
                value={formState.price}
                onChange={(e) => setFormState({ ...formState, price: e.target.value === "" ? "" : Number(e.target.value) })}
                required
              />
            </AdminField>
          </div>

          <AdminField label="Item Picture">
            <div className="flex items-center gap-4 mt-2">
              <div className="w-12 h-12 bg-stone-100 border border-stone-200 flex items-center justify-center rounded-xl shrink-0 overflow-hidden">
                 {formState.image ? (
                   <img src={formState.image} alt="Preview" className="w-full h-full object-cover" />
                 ) : (
                   <ImageIcon className="w-5 h-5 text-stone-500" />
                 )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setFormState({ ...formState, image: ev.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="block w-full text-sm text-[#817875] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#fce7db] file:text-[#5A1824] hover:file:bg-[#f5d9c8] transition-colors cursor-pointer"
                />
                <p className="text-[10px] text-stone-500 mt-1.5">PNG, JPG, or GIF. Max size 2MB.</p>
              </div>
            </div>
          </AdminField>
        </div>
      </AdminModal>
    </div>
  );
}
