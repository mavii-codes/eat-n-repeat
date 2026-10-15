"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Edit2, Archive, ArchiveRestore, Search, ImagePlus, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminForm";
import type { Addon, AddonInput } from "@/lib/admin/types";
import { getApiUrl } from "@/lib/config";
import { MENU_IMAGE_FALLBACK } from "@/lib/menu-image";

const ADDON_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Downscale + compress a photo to a data URL (same ≤2MB discipline as the
// staff menu-photo flow). Keeps add-on rows small in the database.
function compressAddonImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        URL.revokeObjectURL(objectUrl);
        if (!ctx) throw new Error("Canvas not supported in this browser.");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        // Data URLs run ~33% larger than the binary; estimate generously.
        if (dataUrl.length * 0.75 > ADDON_IMAGE_MAX_BYTES) {
          reject(new Error("Photo is too large even after compression. Please pick a smaller photo."));
          return;
        }
        resolve(dataUrl);
      } catch (e: any) {
        reject(new Error(e?.message || "Could not process this image. Try another photo."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This file is not a readable image. Try another file."));
    };
    img.src = objectUrl;
  });
}


// The Admin portal authenticates via the staff JWT (AuthContext), NOT the
// customer next-auth session. Add-on writes therefore need the staff/admin
// token — the customer session token this page used before is absent for
// admin users ("Unauthorized") and forbidden for customers (403).
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";

function getStaffToken(): string | null {
  return getStaffOrAdminToken();
}


export default function AdminAddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAddons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return addons;
    return addons.filter((addon) => addon.name.toLowerCase().includes(q));
  }, [addons, searchQuery]);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [form, setForm] = useState<AddonInput>({ name: "", price: 0, available: true, image: null });
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setPhotoBusy(true);
    try {
      const dataUrl = await compressAddonImage(file);
      setForm((prev) => ({ ...prev, image: dataUrl }));
    } catch (e: any) {
      setError(e?.message || "Could not process this image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const fetchAddons = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/addons?admin=true`);
      if (res.ok) {
        const data = await res.json();
        setAddons(data.addons || []);
      }
    } catch (err) {
      console.warn("Failed to fetch addons:", err);
      // Optional: Set a specific error message if you want it visible on the page
      // setError("Could not connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddons();
  }, []);

  const openCreateModal = () => {
    setEditingAddon(null);
    setForm({ name: "", price: 0, available: true, image: null });
    setError("");
    setOpenModal(true);
  };

  const openEditModal = (addon: Addon) => {
    setEditingAddon(addon);
    setForm({ name: addon.name, price: addon.price, available: addon.available, image: addon.image ?? null });
    setError("");
    setOpenModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Name is required.");
    if (form.price < 0) return setError("Price must be >= 0.");
    const token = getStaffToken();
    // Never fake success: without a database session the backend rejects
    // the write, so report it instead of silently keeping a local row.
    if (!token) return setError("Please log in as Admin/Staff first.");

    try {
      const url = editingAddon 
        ? `${getApiUrl()}/api/addons/${editingAddon.id}`
        : `${getApiUrl()}/api/addons`;
      const method = editingAddon ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setOpenModal(false);
        fetchAddons();
      } else {
        const errData = await res.json();
        setError(errData.message || "Failed to save addon.");
      }
    } catch (err) {
      console.warn("Submit error:", err);
      setError("An error occurred.");
    }
  };

  const toggleAvailability = async (addon: Addon) => {
    const token = getStaffToken();
    if (!token) return;
    try {
      await fetch(`${getApiUrl()}/api/addons/${addon.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: addon.name, price: addon.price, available: !addon.available })
      });
      fetchAddons();
    } catch (err) {
      console.warn("Toggle error:", err);
    }
  };

  return (
    <>
      <AdminPageHeader
        badge="Add-ons & Extras"
        title="Manage Add-ons"
        subtitle="Manage extras that customers can add to their orders before checkout."
        action={
          <AdminButton onClick={openCreateModal} className="flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Extra
          </AdminButton>
        }
      />

      <div className="admin-panel rounded-2xl overflow-hidden shadow-sm border border-stone-200 bg-white">
        <div className="relative px-6 pt-5">
          <Search className="absolute left-10 top-1/2 -translate-y-[calc(50%-10px)] w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search add-ons..."
            aria-label="Search add-ons"
            className="w-full sm:max-w-xs pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/40 transition"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-stone-500">Loading Add-ons...</div>
        ) : addons.length === 0 ? (
          <div className="p-8 text-center text-stone-500 flex flex-col items-center">
            <p className="mb-4">No add-ons created yet.</p>
            <AdminButton onClick={openCreateModal}>Create your first Add-on</AdminButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Add-on Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Price (₱)</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredAddons.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-stone-500">
                      No add-ons match your search.
                    </td>
                  </tr>
                ) : (
                filteredAddons.map((addon) => (
                  <tr key={addon.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-stone-800">
                      <span className="flex items-center gap-3">
                        <img
                          src={addon.image || MENU_IMAGE_FALLBACK}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover bg-stone-100 border border-stone-200 shrink-0"
                        />
                        {addon.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-stone-600">₱{addon.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${addon.available ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                        {addon.available ? 'Available' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleAvailability(addon)}
                          className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition"
                          title={addon.available ? "Hide from customers" : "Make available"}
                        >
                          {addon.available ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4 text-green-600" />}
                        </button>
                        <button
                          onClick={() => openEditModal(addon)}
                          className="p-1.5 text-accent hover:text-accent-dark rounded-lg hover:bg-accent/10 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setOpenModal(false)} />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="font-bold text-lg text-stone-800">
                {editingAddon ? "Edit Add-on" : "New Add-on"}
              </h3>
            </div>
            <div className="p-6 overflow-y-auto">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Add-on Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-stone-50 rounded-xl border border-stone-200 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800000]/30 transition"
                    placeholder="e.g. Extra Cheese"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price (₱)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-stone-50 rounded-xl border border-stone-200 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800000]/30 transition"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Photo (optional)</label>
                  <div className="flex items-center gap-3">
                    <img
                      src={form.image || MENU_IMAGE_FALLBACK}
                      alt="Add-on preview"
                      className="w-14 h-14 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition">
                        <ImagePlus className="w-4 h-4" />
                        {photoBusy ? "Processing…" : "Choose Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={photoBusy}
                          onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                        />
                      </label>
                      {form.image && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image: null }))}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-stone-500 hover:text-rose-700 transition"
                        >
                          <X className="w-3 h-3" /> Remove photo
                        </button>
                      )}
                      <p className="text-[11px] text-stone-400">Square photos look best. Compressed to ≤2MB.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="addon-available"
                    checked={form.available}
                    onChange={(e) => setForm({ ...form, available: e.target.checked })}
                    className="w-4 h-4 text-accent border-stone-300 rounded focus:ring-accent"
                  />
                  <label htmlFor="addon-available" className="text-sm font-bold text-stone-700 cursor-pointer">
                    Available to customers
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-end gap-3 bg-stone-50/50">
              <button
                onClick={() => setOpenModal(false)}
                className="px-4 py-2 text-sm font-bold text-stone-600 hover:text-stone-800 transition"
              >
                Cancel
              </button>
              <AdminButton onClick={handleSubmit}>Save Add-on</AdminButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
