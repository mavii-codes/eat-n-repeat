'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Coffee, Send } from 'lucide-react';
import { getApiUrl } from "@/lib/config";
import { maskEmail } from '@/lib/mask-email';

const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'email' | 'code' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setTimeout(() => setCooldownLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownLeft]);

  async function handleSendCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email || cooldownLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? 'An error occurred.');
      } else {
        // Generic server message covers existent and non-existent emails
        // alike (anti-enumeration); always advance to the code step.
        setCode('');
        setCooldownLeft(RESEND_COOLDOWN_SECONDS);
        setStep('code');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || code.trim().length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.resetToken) {
        setError(data?.message ?? 'Code verification failed.');
      } else {
        setResetToken(data.resetToken);
        setPassword('');
        setConfirmPassword('');
        setStep('password');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/customer-auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? 'Failed to reset password.');
      } else {
        setResetToken('');
        setStep('done');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
          <div role="alert" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Your password has been successfully reset!
          </div>
          <Link href="/customer/login" className="block w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
            Sign In Now
          </Link>
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
              {step === 'email' && "Enter your email address and we'll send you a verification code."}
              {step === 'code' && (
                <>Enter the 6-digit code sent to <span className="font-bold text-stone-800">{maskEmail(email)}</span></>
              )}
              {step === 'password' && 'Code verified. Please enter your new strong password below.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
              <p>{error}</p>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                  {loading ? 'Sending code...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {step === 'code' && (
            <div className="space-y-4">
              <form onSubmit={handleVerifyCode} className="space-y-3">
                <div>
                  <label htmlFor="reset-code" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1 text-center">
                    Enter the 6-digit code
                  </label>
                  <input
                    id="reset-code"
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
                </div>
                <button
                  type="submit"
                  disabled={loading || code.trim().length !== 6}
                  className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
              </form>
              <div className="text-center">
                <p className="text-xs text-stone-500 font-medium mb-2">
                  Didn&apos;t receive the code? Make sure to check your spam folder.
                </p>
                <button
                  onClick={() => handleSendCode()}
                  disabled={loading || cooldownLeft > 0}
                  className="w-full py-3 rounded-full bg-stone-100 hover:bg-stone-200 disabled:bg-stone-100 disabled:text-stone-400 text-stone-800 font-extrabold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : cooldownLeft > 0 ? `Resend Code (${cooldownLeft}s)` : 'Resend Code'}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 pr-12 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
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

              <div>
                <label htmlFor="confirmPassword" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                  CONFIRM NEW PASSWORD
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
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
      </div>
    </div>
  );
}
