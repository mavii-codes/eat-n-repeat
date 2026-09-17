"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Archive, ArchiveRestore } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminForm";
import { useSession } from "next-auth/react";
import type { Addon, AddonInput } from "@/lib/admin/types";
import { getApiUrl } from "@/lib/config";


export default function AdminAddonsPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [form, setForm] = useState<AddonInput>({ name: "", price: 0, available: true });
  const [error, setError] = useState("");

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
    setForm({ name: "", price: 0, available: true });
    setError("");
    setOpenModal(true);
  };

  const openEditModal = (addon: Addon) => {
    setEditingAddon(addon);
    setForm({ name: addon.name, price: addon.price, available: addon.available });
    setError("");
    setOpenModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Name is required.");
    if (form.price < 0) return setError("Price must be >= 0.");
    if (!token) return setError("Unauthorized");

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
                {addons.map((addon) => (
                  <tr key={addon.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-stone-800">{addon.name}</td>
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
                ))}
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
