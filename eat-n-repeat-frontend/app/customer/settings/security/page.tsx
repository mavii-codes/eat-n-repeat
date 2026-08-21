'use client';

import { useState, useEffect } from 'react';
import { CustomerAccountLayout } from '@/components/customer/CustomerAccountLayout';
import { useSession, signOut } from 'next-auth/react';
import { ArrowLeft, Shield, LogOut, Trash2, Mail, Laptop } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from "@/lib/config";


const API_BASE = `${getApiUrl()}/api`;

export default function SecuritySettingsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ status: 'active' });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
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
          setProfile({ status: data.status || 'unverified' });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [userId]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return alert('New passwords do not match!');
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customer-settings/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password changed successfully!');
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Failed to change password');
      }
    } catch (e) {
      alert('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and all your order history will be lost.')) {
      try {
        await fetch(`${API_BASE}/customer-settings/account`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        signOut({ callbackUrl: '/customer/login' });
      } catch (e) {
        alert('Failed to delete account');
      }
    }
  };

  if (loading) return (
    <CustomerAccountLayout>
      <div className="flex items-center justify-center py-20 text-stone-500 font-bold">Loading...</div>
    </CustomerAccountLayout>
  );

  return (
    <CustomerAccountLayout>
      <div className="max-w-2xl space-y-6">
        <div className="mb-4">
          <Link href="/customer/settings" className="md:hidden inline-flex items-center gap-2 text-stone-500 hover:text-[#B91C1C] transition font-bold text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-[#B91C1C] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#451a03]">Password & Security</h1>
              <p className="text-stone-500 mt-1">Manage your passwords and verified devices</p>
            </div>
          </div>
        </div>

        {/* Email Verification Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-stone-50 rounded-xl">
              <Mail className="w-5 h-5 text-stone-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Email Verification</p>
              <p className="text-xs text-stone-500 mt-0.5">Your email address is {profile.status === 'active' ? 'verified' : 'unverified'}.</p>
            </div>
          </div>
          {profile.status === 'active' ? (
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-black border border-green-200">Verified</span>
          ) : (
            <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-black border border-amber-200">Unverified</span>
          )}
        </div>

        {/* Change Password Card */}
        <form onSubmit={handleChangePassword} className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-stone-800 mb-2">Change Password</h2>
          
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">Current Password</label>
            <input 
              type="password" 
              required
              value={passwords.currentPassword}
              onChange={e => setPasswords({...passwords, currentPassword: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">New Password</label>
              <input 
                type="password"
                required
                minLength={8}
                value={passwords.newPassword}
                onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">Confirm New Password</label>
              <input 
                type="password" 
                required
                minLength={8}
                value={passwords.confirmPassword}
                onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
              />
            </div>
          </div>
          
          <div className="pt-4 border-t border-stone-100">
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-stone-800 hover:bg-stone-900 text-white px-8 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

        {/* Active Sessions Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-stone-800 mb-4">Active Sessions</h2>
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <Laptop className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">Current Session</p>
                <p className="text-xs text-stone-500 mt-0.5">Last login: Just now</p>
              </div>
            </div>
            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Active</span>
          </div>
          <div className="pt-4">
            <button 
              onClick={() => signOut({ callbackUrl: '/customer/login' })}
              className="text-sm font-bold text-[#B91C1C] hover:text-red-900 transition flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Log out of all other devices
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm mt-8">
          <h2 className="text-lg font-bold text-red-800 mb-2">Danger Zone</h2>
          <p className="text-xs text-red-600/80 mb-4">Permanently delete your account and all of your content. This action is not reversible, so please continue with caution.</p>
          <button 
            onClick={handleDeleteAccount}
            className="flex items-center justify-center gap-2 w-full sm:w-auto bg-white border border-red-200 hover:bg-red-100 text-red-700 px-6 py-3 rounded-xl text-sm font-bold transition shadow-sm"
          >
            <Trash2 className="w-4 h-4" /> Delete Account Permanently
          </button>
        </div>
      </div>
    </CustomerAccountLayout>
  );
}
