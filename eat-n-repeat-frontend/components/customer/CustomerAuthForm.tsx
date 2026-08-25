'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { Coffee } from 'lucide-react';

type AuthMode = 'signin' | 'signup';

type CustomerAuthFormProps = {
  mode: AuthMode;
};

export function CustomerAuthForm({ mode }: CustomerAuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signup';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/customer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, phone }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.message ?? 'Registration failed.');
          setLoading(false);
          return;
        }

        router.replace(`/customer/verification-pending?email=${encodeURIComponent(email)}`);
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'unverified_email') {
          router.replace(`/customer/verification-pending?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(isSignUp ? 'Account created! Please sign in with your credentials.' : (result.error !== 'CredentialsSignin' ? result.error : 'Invalid email or password.'));
        setLoading(false);
        return;
      }

      router.replace('/customer');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Top Logo */}
        <div className="mb-6 text-center">
          <Logo size="md" variant="customer" href="/customer" />
        </div>

        {/* Main White Auth Card (Matches Screenshot 2) */}
        <div className="w-full max-w-md rounded-[2.5rem] bg-white border border-amber-100/80 shadow-xl p-6 sm:p-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-[#451a03] flex items-center justify-center gap-2">
              <span>{isSignUp ? 'Create account' : 'Welcome back'}</span>
              <Coffee className="w-8 h-8 text-[#B91C1C]" />
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-500 font-medium">
              {isSignUp
                ? 'Join Eat n RepEat for express ordering.'
                : 'Sign in to place your order.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800"
            >
              {error}
            </div>
          )}


          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                  FULL NAME
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maria Santos"
                  className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
                />
              </div>
            )}

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

            {isSignUp && (
              <div>
                <label htmlFor="phone" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                  PHONE <span className="font-normal normal-case text-stone-400">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full px-4 py-3 rounded-2xl border border-amber-200/90 bg-[#FFF8F0] text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#B91C1C] transition"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
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

            {!isSignUp && (
              <div className="flex items-center justify-between pt-1 pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-stone-300 text-[#B91C1C] focus:ring-[#B91C1C]"
                  />
                  <span className="text-[11px] font-bold text-stone-600">Remember Me</span>
                </label>
                <Link href="/customer/forgot-password" className="text-[11px] font-bold text-[#B91C1C] hover:underline">
                  Forgot Password?
                </Link>
              </div>
            )}

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1">
                  CONFIRM PASSWORD
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
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] disabled:bg-stone-300 text-white font-extrabold text-sm shadow-md shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Please wait…'
                ) : (
                  <>
                    <Coffee className="w-4 h-4" />
                    <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Bottom Switch Link */}
          <div className="mt-6 text-center text-xs font-semibold text-stone-600">
            {isSignUp ? (
              <p>
                Already have an account?{' '}
                <Link href="/customer/login" className="font-extrabold text-[#B91C1C] hover:underline">
                  Sign in
                </Link>
              </p>
            ) : (
              <p>
                New to Eat n RepEat?{' '}
                <Link href="/customer/register" className="font-extrabold text-[#B91C1C] hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

