'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { Coffee, Mail, Edit3, Send } from 'lucide-react';
import { getApiUrl } from "@/lib/config";


function VerificationPendingContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'error'|'success', text: string} | null>(null);

  async function handleResend() {
    if (!email) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to resend.' });
      } else {
        setMessage({ type: 'success', text: 'Verification link has been resent! Please check your inbox.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to change email.' });
      } else {
        setMessage({ type: 'success', text: 'Email successfully updated! A new link has been sent.' });
        setEmail(newEmail);
        setIsChangingEmail(false);
        setPassword('');
        setNewEmail('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2.5rem] bg-white border border-amber-100/80 shadow-xl p-6 sm:p-10">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-[#451a03] flex items-center justify-center gap-2">
          <span>Verify Email</span>
          <Mail className="w-8 h-8 text-[#B91C1C]" />
        </h1>
        <p className="mt-2 text-sm text-stone-600 font-medium leading-relaxed">
          We sent a verification link to <br/>
          <span className="font-bold text-stone-900">{email}</span>
        </p>
      </div>

      {message && (
        <div role="alert" className={`mb-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
          message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {message.text}
        </div>
      )}

      {!isChangingEmail ? (
        <div className="space-y-4">
          <p className="text-xs text-stone-500 text-center px-4">
            You must verify your email address before you can sign in and place orders.
          </p>
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? 'Sending...' : 'Resend Verification Link'}
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsChangingEmail(true); setMessage(null); }}
            className="w-full py-3.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-extrabold text-sm transition-all flex items-center justify-center gap-2"
          >
            Change Email Address
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div className="pb-2 border-b border-stone-100 mb-2">
            <h3 className="text-sm font-bold text-stone-800">Change Email Address</h3>
            <p className="text-xs text-stone-500">Please enter your password to confirm this change.</p>
          </div>
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
              NEW EMAIL
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold px-2 py-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsChangingEmail(false)}
              className="w-1/3 py-3 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-extrabold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 py-3 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center"
            >
              {loading ? 'Updating...' : 'Update Email'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center text-xs font-semibold text-stone-600">
        <Link href="/customer/login" className="font-extrabold text-[#B91C1C] hover:underline">
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerificationPendingPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-6 text-center">
          <Logo size="md" variant="customer" href="/customer" />
        </div>
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <VerificationPendingContent />
        </Suspense>
      </div>
    </div>
  );
}
