'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Coffee, Mail, ArrowLeft } from 'lucide-react';
import { getApiUrl } from "@/lib/config";


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'An error occurred.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <Link href="/customer/login" className="inline-block mb-6">
            <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-gray-600 transition" />
          </Link>
          
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-6">
            <Mail className="w-6 h-6 text-[#B91C1C]" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h1>
          
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            We have sent a reset password link to <span className="font-bold text-gray-900">{email}</span>
          </p>
          
          <p className="text-sm text-gray-600 leading-relaxed">
            Didn't get the email? Make sure to check your spam folder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-6 text-center">
          <Logo size="md" variant="customer" href="/customer" />
        </div>

        <div className="w-full max-w-md rounded-[2.5rem] bg-white border border-amber-100/80 shadow-xl p-6 sm:p-10">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-[#451a03] flex items-center justify-center gap-2">
              <span>Reset Password</span>
              <Coffee className="w-8 h-8 text-[#B91C1C]" />
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-500 font-medium">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
              <p>{error}</p>
              {error === "No account was found with this email address. Please check your email or create an account." && (
                <div className="mt-3">
                  <Link 
                    href="/customer/register" 
                    className="inline-block px-4 py-2 bg-[#B91C1C] text-white rounded-full text-xs font-extrabold hover:bg-[#991B1B] transition-colors shadow-sm"
                  >
                    Sign Up Now
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs font-semibold text-stone-600">
            <Link href="/customer/login" className="font-extrabold text-[#B91C1C] hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
