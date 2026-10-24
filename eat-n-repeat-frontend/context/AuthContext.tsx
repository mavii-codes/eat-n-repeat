"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminData } from "@/context/AdminDataContext";
import { verifyPassword, ensureHashed } from "@/lib/admin/password";
import { getApiUrl } from "@/lib/config";
import {
  SESSION_KEY,
  STAFF_TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  isTokenValid,
  syncAuthTokens,
  clearAuthTokens,
} from "@/lib/admin/auth-token";
import type { StaffAccount, StaffAccountInput } from "@/lib/admin/types";

const BACKEND_TIMEOUT_MS = 8000;

type StoredSession = Omit<StaffAccount, "password"> & { token?: string };

function toStoredSession(user: StaffAccount, token?: string): StoredSession {
  const { password: _removed, ...rest } = user as StaffAccount & { password?: string };
  return token ? { ...rest, token } : rest;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type AuthContextValue = {
  user: StaffAccount | null;
  loading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  clearError: () => void;
  changePassword: (newPassword: string) => void;
  verifyCurrentPassword: (password: string) => Promise<boolean>;
  updateProfile: (name: string, email: string, username: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { staffAccounts, updateStaffAccount } = useAdminData();
  const router = useRouter();

  // Load session from local storage on mount.
  // Cross-device: when the session carries a backend token, the backend
  // (/api/auth/me) is the source of truth — do NOT require the account to
  // exist in this device's localStorage staff list (Laptop B has never seen
  // Laptop A's localStorage). Offline (backend unreachable) falls back to
  // the local account check.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const storedSession = localStorage.getItem(SESSION_KEY);
      if (!storedSession) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const parsedUser = JSON.parse(storedSession) as StoredSession;
        if (parsedUser.token) {
          if (!isTokenValid(parsedUser.token)) {
            clearAuthTokens();
            if (!cancelled) setLoading(false);
            return;
          }
          try {
            const res = await fetchWithTimeout(
              `${getApiUrl()}/api/auth/me`,
              { headers: { Authorization: `Bearer ${parsedUser.token}` } },
              BACKEND_TIMEOUT_MS,
            );
            if (res.status === 401 || res.status === 403) {
              clearAuthTokens();
              if (!cancelled) setLoading(false);
              return;
            }
            if (res.ok) {
              const data = await res.json().catch(() => null);
              const backendUser = data?.user;
              if (backendUser?.id) {
                const sessionUser = {
                  id: backendUser.id,
                  name: backendUser.name,
                  username: backendUser.username,
                  email: backendUser.email,
                  role: backendUser.role,
                  status: backendUser.status ?? "active",
                  // Backend survives a reload's forced-change state through
                  // /api/auth/me; map it so guards and the login redirect see it.
                  // When /me doesn't send the field (older backend), keep the
                  // value stored at login instead of resetting it.
                  mustChangePassword:
                    backendUser.mustChangePassword != null
                      ? Boolean(backendUser.mustChangePassword)
                      : Boolean(
                          (parsedUser as { mustChangePassword?: boolean })
                            .mustChangePassword,
                        ),
                } as StaffAccount;
                syncAuthTokens(parsedUser.token, backendUser.role);
                if (!cancelled) {
                  setUser(sessionUser);
                  setLoading(false);
                }
                return;
              }
            }
            // Other statuses (e.g. 500): fall through to local check below
            // so a reachable-but-erroring backend does not log the user out.
          } catch {
            // Backend unreachable — trust the local record (offline mode).
            syncAuthTokens(parsedUser.token, parsedUser.role);
          }
        }
        // Offline fallback: read the device's local admin-data cache directly
        // (context state may still be loading in this one-shot effect).
        const readLocalStaff = (): StaffAccount | null => {
          const fromContext = staffAccounts.find(
            (acc) => acc.id === parsedUser.id && !acc.archived && acc.status === "active",
          );
          if (fromContext) return fromContext;
          try {
            const raw = localStorage.getItem("eat-n-repeat-admin-data");
            if (!raw) return null;
            const parsed = JSON.parse(raw) as {
              staffAccounts?: StaffAccount[];
            };
            return (
              parsed.staffAccounts?.find(
                (acc) =>
                  acc.id === parsedUser.id && !acc.archived && acc.status === "active",
              ) ?? null
            );
          } catch {
            return null;
          }
        };
        const activeStaff = readLocalStaff();
        if (!activeStaff) {
          // No backend token to validate with and no local record: this
          // device cannot restore an offline session. If a token exists the
          // backend already had its chance above (unreachable = keep session
          // for retry on next load rather than logging out).
          if (!parsedUser.token) localStorage.removeItem(SESSION_KEY);
          if (!cancelled) {
            if (parsedUser.token) {
              const { token, ...rest } = parsedUser;
              setUser(rest as StaffAccount);
            }
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setUser({ ...activeStaff, password: undefined } as StaffAccount);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
      if (!cancelled) setLoading(false);
    };
    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = () => setError(null);

  const login = async (usernameOrEmail: string, passwordInput: string): Promise<boolean> => {
    setError(null);
    const identifier = usernameOrEmail.trim();
    const apiUrl = getApiUrl();

    // 1) Backend first (existing /api/auth/login). A 401/403 is a real
    // denial — never fall back to local in that case. Only network-level
    // failure (backend unreachable = offline café) uses the local fallback.
    let serverMessage: string | null = null;
    try {
      const res = await fetchWithTimeout(
        `${apiUrl}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password: passwordInput }),
        },
        BACKEND_TIMEOUT_MS
      );
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.user && data?.token) {
          const backendUser = data.user;
          const sessionUser = {
            id: backendUser.id,
            name: backendUser.name,
            username: backendUser.username,
            email: backendUser.email,
            role: backendUser.role,
            status: backendUser.status ?? "active",
            // Backend contract: login responses may flag mustChangePassword
            // for accounts carrying the administrator-generated password.
            mustChangePassword: Boolean(backendUser.mustChangePassword),
          } as StaffAccount;
          setUser(sessionUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(toStoredSession(sessionUser, data.token)));
          syncAuthTokens(data.token, backendUser.role);
          return true;
        }
      } else if (res.status === 401 || res.status === 403 || res.status === 429) {
        const data = await res.json().catch(() => null);
        const message = typeof data?.message === "string" ? data.message.trim() : "";
        // Preserve server copy (including 429 lockout/captcha copy) as-is.
        setError(
          message ||
            (res.status === 429
              ? "Too many sign-in attempts. Try again later."
              : "Invalid username/email or password."),
        );
        return false;
      } else {
        // Reachable backend, unexpected status (404 = wrong backend URL such
        // as a Vercel origin instead of Render; 5xx = broken backend/DB).
        // Keep a server-provided explanation only — never the URL or status.
        const data = await res.json().catch(() => null);
        if (typeof data?.message === "string" && data.message.trim()) {
          serverMessage = data.message.trim();
        }
      }
      // Other statuses fall through to the local fallback below.
    } catch {
      // Network failure / timeout — offline mode: use local verification.
    }

    // 2) Local fallback (offline café): verify against hashed local passwords.
    const matchedAccount = staffAccounts.find(
      (acc) =>
        (acc.username?.toLowerCase() === identifier.toLowerCase() ||
          acc.email?.toLowerCase() === identifier.toLowerCase()) &&
        !acc.archived
    );

    if (!matchedAccount) {
      // Never expose the backend URL or HTTP status in the sign-in form.
      // Show a server-provided message when there is one; otherwise use the
      // generic staff copy. (401/403/429 already returned above.)
      setError(serverMessage ?? "Sign-in failed. Please try again.");
      return false;
    }

    if (matchedAccount.status !== "active") {
      setError("This account is currently inactive. Please contact the administrator.");
      return false;
    }

    if (!verifyPassword(passwordInput, matchedAccount.password)) {
      setError("Invalid username/email or password.");
      return false;
    }

    // Migrate legacy plaintext to hash on successful login.
    if (matchedAccount.password && !matchedAccount.password.startsWith("$2")) {
      updateStaffAccount(matchedAccount.id, {
        name: matchedAccount.name,
        username: matchedAccount.username,
        email: matchedAccount.email,
        password: matchedAccount.password,
        role: matchedAccount.role,
        status: matchedAccount.status,
      });
    }

    const { password: _removed, ...sessionUser } = matchedAccount;
    setUser(sessionUser as StaffAccount);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return true;
  };

  const logout = () => {
    setUser(null);
    clearAuthTokens();
    router.push("/login");
  };

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === "admin";

  // Verifies the current password without ever exposing a stored one:
  // online it re-authenticates against the backend, offline it compares
  // against the locally hashed record.
  const verifyCurrentPassword = async (passwordInput: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await fetchWithTimeout(
        `${getApiUrl()}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: user.username || user.email,
            password: passwordInput,
          }),
        },
        BACKEND_TIMEOUT_MS
      );
      if (res.ok) return true;
      if (res.status === 401 || res.status === 403) return false;
    } catch {
      // Backend unreachable — fall through to local verification.
    }
    const record = staffAccounts.find((acc) => acc.id === user.id);
    return verifyPassword(passwordInput, record?.password);
  };

  const changePassword = (newPassword: string) => {
    if (!user) return;

    const input: StaffAccountInput = {
      name: user.name,
      username: user.username,
      email: user.email,
      password: newPassword,
      role: user.role,
      status: user.status,
    };

    updateStaffAccount(user.id, input);

    setUser(user);
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        delete parsed.password;
        localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  };

  const updateProfile = (name: string, email: string, username: string) => {
    if (!user) return;

    const current = staffAccounts.find((acc) => acc.id === user.id);
    if (!current) return;
    // Preserve the existing (hashed) credential — never a default password.
    updateStaffAccount(user.id, {
      name,
      username,
      email,
      password: current.password || "",
      role: user.role,
      status: user.status,
    });

    const updatedUser = { ...user, name, email, username };
    setUser(updatedUser);
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.name = name;
        parsed.email = email;
        parsed.username = username;
        delete parsed.password;
        localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated,
        isAdmin,
        clearError,
        changePassword,
        verifyCurrentPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
