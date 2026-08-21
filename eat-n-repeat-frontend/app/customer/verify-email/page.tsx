'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getApiUrl } from "@/lib/config";


function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('The verification link is missing or invalid.');
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
            Request New Link
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
