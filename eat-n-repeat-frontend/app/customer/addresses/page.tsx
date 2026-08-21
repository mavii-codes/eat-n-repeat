'use client';

import { useState, useEffect } from 'react';
import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { useSession } from 'next-auth/react';
import { ArrowLeft, MapPin, Edit2, Plus, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from "@/lib/config";


const API_BASE = `${getApiUrl()}/api`;

type Address = {
  id: string;
  address_name: string;
  full_address: string;
  barangay: string;
  municipality: string;
  landmarks: string;
  delivery_notes: string;
  is_default: number | boolean;
};

export default function SavedAddressesPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    address_name: '',
    full_address: '',
    barangay: '',
    municipality: 'Cordova',
    landmarks: '',
    delivery_notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, [userId]);

  const fetchAddresses = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/customer-addresses`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (address?: Address) => {
    if (address) {
      setEditingId(address.id);
      setFormData({
        address_name: address.address_name,
        full_address: address.full_address,
        barangay: address.barangay,
        municipality: address.municipality,
        landmarks: address.landmarks || '',
        delivery_notes: address.delivery_notes || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        address_name: '',
        full_address: '',
        barangay: '',
        municipality: 'Cordova',
        landmarks: '',
        delivery_notes: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    
    try {
      const url = editingId 
        ? `${API_BASE}/customer-addresses/${editingId}`
        : `${API_BASE}/customer-addresses`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        await fetchAddresses();
        setShowModal(false);
      } else {
        alert('Failed to save address.');
      }
    } catch (e) {
      alert('An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId || !confirm('Are you sure you want to delete this address?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/customer-addresses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        await fetchAddresses();
        if (showModal && editingId === id) {
          setShowModal(false);
        }
      }
    } catch (e) {
      alert('Failed to delete address.');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/customer-addresses/${id}/default`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        await fetchAddresses();
      }
    } catch (e) {
      alert('Failed to set default address.');
    }
  };

  if (loading) return (
    <CustomerAccountLayout>
      <div className="flex items-center justify-center py-20 text-stone-500 font-bold">Loading...</div>
    </CustomerAccountLayout>
  );

  return (
    <CustomerAccountLayout>
      <div className="max-w-xl relative">
        <div className="mb-6">
          <Link href="/customer/settings" className="md:hidden inline-flex items-center gap-2 text-stone-500 hover:text-[#B91C1C] transition font-bold text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Account Management
          </Link>
          <h1 className="text-2xl font-black text-[#451a03]">Saved Addresses</h1>
          <p className="text-sm text-stone-500 mt-1">Keep your delivery destinations organized</p>
        </div>

        {/* Address List */}
        <div className="space-y-4 mb-6">
          {addresses.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center shadow-sm">
              <MapPin className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">You don't have any saved addresses yet.</p>
            </div>
          ) : (
            addresses.map(addr => (
              <div key={addr.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative group transition hover:border-[#B91C1C]/50">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-stone-800">{addr.address_name}</p>
                      {addr.is_default ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-[#B91C1C] text-white px-2 py-0.5 rounded">Default</span>
                      ) : (
                        <button onClick={() => handleSetDefault(addr.id)} className="text-[10px] font-bold text-stone-400 hover:text-[#B91C1C]">
                          Set Default
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 truncate">{addr.full_address}, {addr.barangay}, {addr.municipality}</p>
                    {addr.delivery_notes && <p className="text-xs text-stone-400 mt-1 truncate">Note: {addr.delivery_notes}</p>}
                  </div>
                  <button 
                    onClick={() => handleOpenModal(addr)}
                    className="absolute top-5 right-4 p-2 text-stone-400 hover:text-stone-700 bg-stone-50 rounded-full transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="w-full bg-[#B91C1C] hover:bg-red-800 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add New Address
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-black text-[#451a03]">
                {editingId ? 'Edit Address' : 'New Address'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-stone-400 hover:text-stone-700 bg-stone-50 rounded-full transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="addressForm" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Address Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Home, Work"
                    value={formData.address_name} 
                    onChange={e => setFormData({...formData, address_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Full Address *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Street name, Building, House No."
                    value={formData.full_address} 
                    onChange={e => setFormData({...formData, full_address: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">Barangay *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Ibabao"
                      value={formData.barangay} 
                      onChange={e => setFormData({...formData, barangay: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">Municipality / City *</label>
                    <select 
                      required
                      value={formData.municipality} 
                      onChange={e => setFormData({...formData, municipality: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50 appearance-none"
                    >
                      <option value="Cordova">Cordova</option>
                      <option value="Lapu-Lapu">Lapu-Lapu</option>
                      <option value="Cebu City">Cebu City</option>
                      <option value="Mandaue City">Mandaue City</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Landmarks (optional)</label>
                  <input 
                    type="text" 
                    placeholder="Near hospital, blue gate..."
                    value={formData.landmarks} 
                    onChange={e => setFormData({...formData, landmarks: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Delivery Instructions (optional)</label>
                  <input 
                    type="text" 
                    placeholder="Leave at front desk..."
                    value={formData.delivery_notes} 
                    onChange={e => setFormData({...formData, delivery_notes: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all outline-none bg-stone-50"
                  />
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between gap-3 shrink-0 bg-stone-50 rounded-b-3xl">
              {editingId ? (
                <button 
                  type="button"
                  onClick={() => handleDelete(editingId)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : (
                <div /> // Spacer
              )}
              <button 
                type="submit"
                form="addressForm"
                disabled={isSaving}
                className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-[#B91C1C] hover:bg-red-800 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerAccountLayout>
  );
}
