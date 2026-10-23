'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { Coffee } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

type AuthMode = 'signin' | 'signup';

type CustomerAuthFormProps = {
  mode: AuthMode;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

function getTurnstile(): TurnstileApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

export function CustomerAuthForm({ mode }: CustomerAuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState('');
  const [cfTurnstileToken, setCfTurnstileToken] = useState('');
  const startedAtRef = useRef<number | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const isSignUp = mode === 'signup';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (isSignUp && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
  }, [isSignUp]);

  const renderTurnstile = useCallback(() => {
    if (!turnstileSiteKey || turnstileWidgetIdRef.current !== null) return;
    const container = turnstileContainerRef.current;
    const turnstile = getTurnstile();
    if (!container || !turnstile) return;
    turnstileWidgetIdRef.current = turnstile.render(container, {
      sitekey: turnstileSiteKey,
      callback: (token) => setCfTurnstileToken(token),
      'expired-callback': () => setCfTurnstileToken(''),
      'error-callback': () => setCfTurnstileToken(''),
    });
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (!isSignUp || !turnstileSiteKey) return;
    // The script may already be loaded (e.g. navigating back to this form).
    renderTurnstile();
  }, [isSignUp, turnstileSiteKey, renderTurnstile]);

  useEffect(() => {
    return () => {
      const turnstile = getTurnstile();
      const widgetId = turnstileWidgetIdRef.current;
      if (turnstile && widgetId !== null) {
        turnstile.remove(widgetId);
      }
      turnstileWidgetIdRef.current = null;
    };
  }, []);

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
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          setLoading(false);
          return;
        }

        // Single source of truth: the Express backend (creates the DB row,
        // the verification token, and sends the verification email).
        // Sign-up collects basic credentials only — the mobile number is
        // captured at the first checkout and then becomes permanent.
        const res = await fetch(`${getApiUrl()}/api/customer-auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            company,
            startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
            ...(cfTurnstileToken ? { cfTurnstileToken } : {}),
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // 429 carries server copy (rate limit / lockout). Never replace it
          // with a fabricated credentials error.
          setError(
            data?.message ??
              (res.status === 429
                ? 'Too many sign-ups from this connection. Try again later.'
                : 'Registration failed.'),
          );
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
              <div aria-hidden="true" className="sr-only">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            )}

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

            {isSignUp && turnstileSiteKey && (
              <div ref={turnstileContainerRef} className="flex justify-center overflow-hidden pt-1" />
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

      {isSignUp && turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}
    </div>
  );
}

