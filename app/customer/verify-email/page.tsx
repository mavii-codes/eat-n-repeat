'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getApiUrl } from "@/lib/config";
import { maskEmail } from '@/lib/mask-email';


function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'code'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // New code flow (no link token): show the 6-digit code form instead.
    if (!token) {
      setStatus('code');
      return;
    }

    fetch(`${getApiUrl()}/api/customer-auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Verification failed');
        }
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
  }, [token]);

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || code.trim().length !== 6) return;
    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Verification failed');
      }
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  if (status === 'code') {
    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-black text-[#451a03]">Verify Your Email</h2>
          <p className="text-sm text-stone-600 mt-1">
            We sent a 6-digit code to <span className="font-bold text-stone-900">{email ? maskEmail(email) : 'your email'}</span>
          </p>
        </div>
        {errorMsg && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleVerifyCode} className="space-y-3">
          {!emailParam && (
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
            />
          )}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-center text-2xl font-black tracking-[0.5em] text-stone-900 placeholder:text-stone-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
          />
          <button
            type="submit"
            disabled={verifying || code.trim().length !== 6 || !email}
            className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {verifying ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>
        <div className="text-center text-xs font-semibold text-stone-600">
          <Link href="/customer/verification-pending" className="font-extrabold text-[#B91C1C] hover:underline">
            Resend Code
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="text-center p-6 space-y-4 flex flex-col items-center">
        <Loader2 className="w-10 h-10 text-stone-400 animate-spin" />
        <h2 className="text-xl font-bold text-stone-800">Verifying Email...</h2>
        <p className="text-sm text-stone-500">Please wait while we verify your account.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center p-6 space-y-4 flex flex-col items-center">
        <XCircle className="w-12 h-12 text-rose-600" />
        <h2 className="text-xl font-bold text-rose-800">Verification Failed</h2>
        <p className="text-sm text-stone-600">{errorMsg}</p>
        <div className="pt-4 flex gap-3 w-full">
          <Link href="/customer/verification-pending" className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-full text-sm font-bold transition-all">
            Request New Code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center p-6 space-y-4 flex flex-col items-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
      <h2 className="text-xl font-bold text-emerald-800">Email Verified!</h2>
      <p className="text-sm text-stone-600">Your account is now fully active. You can sign in and start placing orders.</p>
      <div className="pt-4 w-full">
        <Link href="/customer/login" className="block w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
          Continue to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-6 text-center">
          <Logo size="md" variant="customer" href="/customer" />
        </div>

        <div className="w-full max-w-md rounded-[2.5rem] bg-white border border-amber-100/80 shadow-xl p-4 sm:p-6">
          <Suspense fallback={<div className="text-center p-6">Loading...</div>}>
            <VerifyEmailContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
