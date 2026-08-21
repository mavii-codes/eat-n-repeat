'use client';

import { useState, useEffect } from 'react';
import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { useSession } from 'next-auth/react';
import { ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from "@/lib/config";


const API_BASE = `${getApiUrl()}/api`;

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    avatar_url: '', // keep in state so we don't accidentally overwrite it as empty on save
    notification_preferences: {}
  });

  useEffect(() => {
    if (!userId) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/customer-settings`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            avatar_url: data.avatar_url || '',
            notification_preferences: data.notification_preferences || {}
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [userId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/customer-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          notification_preferences: profile.notification_preferences
        })
      });
      alert('Account information saved successfully!');
    } catch (e) {
      alert('Failed to save account information.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <CustomerAccountLayout>
      <div className="flex items-center justify-center py-20 text-stone-500 font-bold">Loading...</div>
    </CustomerAccountLayout>
  );

  return (
    <CustomerAccountLayout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <Link href="/customer/settings" className="md:hidden inline-flex items-center gap-2 text-stone-500 hover:text-[#B91C1C] transition font-bold text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#451a03]">Account Information</h1>
              <p className="text-stone-500 mt-1">Update your name, email, and phone number</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">Full Name</label>
            <input 
              type="text" 
              required
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">Email Address</label>
            <input 
              type="email" 
              value={profile.email} 
              disabled
              className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50 text-stone-500 text-sm cursor-not-allowed"
            />
            <p className="text-[11px] text-stone-400 mt-1.5">Email address cannot be changed for security reasons.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">Mobile Number</label>
            <input 
              type="tel" 
              required
              value={profile.phone} 
              onChange={e => setProfile({...profile, phone: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
            />
          </div>

          <div className="pt-4 border-t border-stone-100">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold rounded-xl transition shadow-md shadow-red-500/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </CustomerAccountLayout>
  );
}
