"use client";

/* Forced password change screen (staff + admin).

   Reached when (a) the stored session carries mustChangePassword, or (b) any
   admin/staff API answers 403 { code: "MUST_CHANGE_PASSWORD" }.

   Flow decision (matches AuthContext's login semantics): after the backend
   confirms the new password, the stored session is cleared completely and
   the browser is routed to /login with a note. AuthContext derives the
   signed-in user from localStorage on load, so a clean storage state is the
   only reliable way to end up re-signing in — there is no "re-login then
   route by role" step here; the ordinary login page handles that after the
   user signs in with the new password. */

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import {
  getApiUrl,
} from "@/lib/config";
import {
  clearAuthTokens,
  getStaffOrAdminToken,
} from "@/lib/admin/auth-token";

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // No usable staff/admin token → nothing to change; the normal login page
  // is the only sensible destination.
  useEffect(() => {
    if (!getStaffOrAdminToken()) {
      router.replace("/login");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errors: FieldErrors = {};
    if (!currentPassword) {
      errors.current = "Please enter your current password.";
    }
    if (!newPassword || newPassword.length < 8) {
      errors.next = "New password must be at least 8 characters.";
    }
    if (newPassword && confirmPassword !== newPassword) {
      errors.confirm = "Passwords do not match.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const token = getStaffOrAdminToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/change-initial-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string;
        code?: string;
      } | null;

      if (res.ok) {
        // Success: fully clear the stored session (AuthContext counts as
        // signed-out once storage is empty) and land on the login page,
        // which picks up ?password=changed and shows the note.
        clearAuthTokens();
        window.location.assign("/login?password=changed");
        return;
      }

      const message =
        typeof body?.message === "string" && body.message.trim()
          ? body.message.trim()
          : "Could not change the password. Try again.";

      if (res.status === 401) {
        // Session ended underneath us — signing in again is the only path.
        clearAuthTokens();
        setSubmitError(`${message} Please sign in, then try again.`);
        return;
      }
      if (res.status === 400) {
        // Verification-level failure (usually the current password).
        setFieldErrors({ current: message });
        return;
      }
      // 403 MUST_CHANGE_PASSWORD and anything else: show the server message.
      setSubmitError(message);
    } catch {
      setSubmitError(
        "Could not reach the server. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 selection:bg-[#8B2E2E] selection:text-white">
      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header, in the login card's language */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Eat n' RepEat Café Logo"
            width={72}
            height={72}
            unoptimized
            className="object-contain"
          />
          <h1 className="mt-5 text-[24px] font-bold text-[#2D2A26] leading-tight">
            Change your password
          </h1>
          <p className="mt-2 text-[14px] text-[#2D2A26]/60 font-medium px-2">
            Create a new password to finish signing in. You will use it at your
            next sign-in.
          </p>
        </div>

        {submitError && (
          <div className="mb-6 rounded-lg p-3.5 text-[14px] font-semibold text-[#8B2E2E] bg-red-50 border border-red-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={(v) => {
              setCurrentPassword(v);
              setSubmitError(null);
              if (fieldErrors.current)
                setFieldErrors((prev) => ({ ...prev, current: undefined }));
            }}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent(!showCurrent)}
            placeholder="Temporary password"
            error={fieldErrors.current}
            disabled={busy}
          />

          <PasswordField
            label="New password"
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setSubmitError(null);
              if (fieldErrors.next)
                setFieldErrors((prev) => ({ ...prev, next: undefined }));
            }}
            visible={showNext}
            onToggleVisible={() => setShowNext(!showNext)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            error={fieldErrors.next}
            disabled={busy}
          />

          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setSubmitError(null);
              if (fieldErrors.confirm)
                setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            visible={showNext}
            onToggleVisible={() => setShowNext(!showNext)}
            placeholder="Re-enter the new password"
            autoComplete="new-password"
            error={fieldErrors.confirm}
            disabled={busy}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full h-[54px] bg-[#8B2E2E] hover:bg-[#6F2323] text-white rounded-xl text-[15px] font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98] shadow-md tracking-wider"
          >
            {busy ? (
              <>
                <div className="h-[20px] w-[20px] animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                <span>Changing...</span>
              </>
            ) : (
              <span>Save New Password</span>
            )}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-[#E8DDD5]">
          <p className="text-[13px] text-[#2D2A26]/60 leading-relaxed font-medium text-center">
            <span className="flex items-center justify-center gap-2 font-bold text-[#8B2E2E] mb-1">
              <Lock className="w-4 h-4" />
              Your new password
            </span>
            goes into effect immediately and is required on every device you
            sign in from.
          </p>
        </div>
      </div>
    </div>
  );
}

/* One password row, in the login page's icon-input style, with an inline
   validation slot. */
function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder,
  error,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[14px] font-bold text-[#2D2A26] text-left mb-2">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2D2A26]/40 group-focus-within:text-[#8B2E2E] transition-colors">
          <Lock className="w-5 h-5" />
        </div>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required
          className={`w-full h-[54px] pl-[44px] pr-12 rounded-xl border bg-[#FAF8F5] text-[15px] font-medium text-[#2D2A26] placeholder:text-[#2D2A26]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/20 focus:border-[#8B2E2E] hover:border-[#C97A40]/40 transition-all shadow-sm ${
            error
              ? "border-red-400 ring-2 ring-red-200"
              : "border-[#E8DDD5]"
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#2D2A26]/40 hover:text-[#8B2E2E] transition-colors focus:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-[12px] font-semibold text-[#8B2E2E]">{error}</p>
      )}
    </div>
  );
}
