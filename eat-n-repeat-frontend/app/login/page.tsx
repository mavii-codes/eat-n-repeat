"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { AdminButton, AdminField, AdminInput } from "@/components/admin/AdminForm";

export default function LoginPage() {
  const { user, login, loading: authLoading, error, clearError } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForgotModal, setShowForgotModal] = useState(false);
  const router = useRouter();

  // Clear context error on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/staff");
      }
    }
  }, [user, authLoading, router]);

  // Handle local context error changes
  useEffect(() => {
    if (error) {
      setErrorMsg(error);
    }
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = usernameOrEmail.trim();
    const pass = password.trim();

    if (!identifier || !pass) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const success = await login(identifier, pass);
      if (success) {
        // Redirection is handled by the useEffect above
      }
    });
  }

  if (authLoading) {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="font-serif text-lg text-white/70">Loading Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen flex items-center justify-center px-4 py-12">
      <div className="admin-panel w-full max-w-md rounded-2xl p-8 transition-all">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-2" />
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#800000] mt-3">
            Portal Sign In
          </h1>
          <p className="mt-1 text-sm text-muted">
            Enter your credentials to access your workspace.
          </p>
        </div>

        {errorMsg && (
          <div className="admin-alert mt-6 rounded-xl p-4 text-xs font-semibold text-amber-900 border border-amber-200">
            <div className="flex gap-2.5 items-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-amber-700">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AdminField label="Username or Email">
            <AdminInput
              type="text"
              value={usernameOrEmail}
              onChange={(e) => {
                setUsernameOrEmail(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="e.g. admin or maria@eatnrepeat.com"
              disabled={isPending}
              autoComplete="username"
              required
            />
          </AdminField>

          <AdminField label="Password">
            <div className="relative">
              <AdminInput
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••••••"
                disabled={isPending}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </AdminField>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-gradient-to-r from-accent to-accent-dark text-white rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-[0_12px_32px_-14px_rgba(196,30,58,0.35)]"
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-accent/10 pt-5 text-center">
          <p className="text-xs leading-5 text-muted">
            <span className="font-semibold text-accent">Security Note:</span> Public registration is disabled. Staff accounts are created and managed exclusively by the Café Admin.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="admin-panel w-full max-w-md rounded-2xl p-6 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            <h2 className="font-serif text-xl font-bold text-[#800000] mb-2">
              Forgot Password?
            </h2>
            <p className="text-xs text-muted leading-5 mb-4">
              Eat n&apos; Repeat Café uses credentials-based local account management.
            </p>

            <div className="space-y-4">
              <div className="rounded-xl border border-accent/15 bg-accent-light/30 p-4">
                <p className="text-xs font-bold text-[#800000]">For Staff Accounts</p>
                <p className="text-xs text-muted mt-1 leading-5">
                  Staff accounts cannot register themselves or self-reset passwords. Please contact your Café Administrator **Marvin Barro** (owner@eatnrepeat.com) or request a reset in the staff accounts dashboard to get a new temporary password.
                </p>
              </div>

              <div className="rounded-xl border border-accent/15 bg-accent-light/30 p-4">
                <p className="text-xs font-bold text-[#800000]">For Admin Account</p>
                <p className="text-xs text-muted mt-1 leading-5">
                  If you are the Admin and forgot your password, you can reset your local database to restore the default credentials (`admin`/`admin123`) by clearing the browser local storage.
                </p>
                <button
                  onClick={() => {
                    if (confirm("This will clear your local storage and reset all café data (menu, stock, and staff) to initial default mock values. Continue?")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent text-accent bg-white px-3 py-1.5 text-xs font-semibold hover:bg-accent-light transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M21 21H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H21a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
                  </svg>
                  Reset Local Database
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <AdminButton onClick={() => setShowForgotModal(false)}>
                Close
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
