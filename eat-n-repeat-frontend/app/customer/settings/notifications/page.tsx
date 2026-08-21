'use client';

import { useState, useEffect } from 'react';
import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from "@/lib/config";


const API_BASE = `${getApiUrl()}/api`;

export default function NotificationsSettingsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [preferences, setPreferences] = useState({
    order_status: true,
    promotions: true,
    new_menu: true,
    announcements: true
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
          setProfile(data);
          if (data.notification_preferences) {
            setPreferences(data.notification_preferences);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [userId]);

  const handleSavePreferences = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/customer-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...profile,
          notification_preferences: preferences
        })
      });
      alert('Notification preferences saved successfully!');
    } catch (e) {
      alert('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <CustomerAccountLayout>
      <div className="flex items-center justify-center py-20 text-stone-500 font-bold">Loading...</div>
    </CustomerAccountLayout>
  );

  const notificationOptions = [
    { id: 'order_status', title: 'Order Status Updates', desc: 'Get notified when your order is confirmed, prepared, and delivered.' },
    { id: 'promotions', title: 'Promotional Offers', desc: 'Receive exclusive discounts and special weekend deals.' },
    { id: 'new_menu', title: 'New Menu Items', desc: 'Be the first to know when we add new seasonal items to the menu.' },
    { id: 'announcements', title: 'Café Announcements', desc: 'Important updates about operating hours, holidays, or maintenance.' },
  ];

  return (
    <CustomerAccountLayout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <Link href="/customer/settings" className="md:hidden inline-flex items-center gap-2 text-stone-500 hover:text-[#B91C1C] transition font-bold text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#451a03]">Notifications</h1>
                <p className="text-stone-500 mt-1">Choose what you want to be notified about</p>
              </div>
            </div>
            
            <button 
              onClick={handleSavePreferences}
              disabled={saving}
              className="hidden sm:block bg-[#B91C1C] hover:bg-red-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="divide-y divide-stone-100">
            {notificationOptions.map(pref => (
              <div key={pref.id} className="py-5 first:pt-0 last:pb-0 flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-bold text-stone-800">{pref.title}</p>
                  <p className="text-xs sm:text-sm text-stone-500 mt-1 leading-relaxed">{pref.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={(preferences as any)[pref.id]} 
                    onChange={e => setPreferences({...preferences, [pref.id]: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B91C1C]"></div>
                </label>
              </div>
            ))}
          </div>
          
          <div className="pt-6 sm:hidden border-t border-stone-100">
            <button 
              onClick={handleSavePreferences}
              disabled={saving}
              className="w-full bg-[#B91C1C] hover:bg-red-800 text-white px-6 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </CustomerAccountLayout>
  );
}
