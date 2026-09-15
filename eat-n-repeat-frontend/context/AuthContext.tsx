"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminData } from "@/context/AdminDataContext";
import { getApiUrl } from "@/lib/config";
import type { StaffAccount, StaffAccountInput } from "@/lib/admin/types";

const TOKEN_KEY = "eat-n-repeat-staff-token";
const SESSION_KEY = "eat-n-repeat-auth-session";

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
  updateProfile: (name: string, email: string, username: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateStaffAccount } = useAdminData();
  const router = useRouter();

  // Restore session from JWT token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // Clean up legacy session key
      localStorage.removeItem(SESSION_KEY);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          // Fail fast: a dead/stale backend address must never spin forever.
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const { user: apiUser } = await res.json();
          setUser(apiUser as StaffAccount);
        } else {
          // Server answered but rejected the token → it is invalid. Drop it.
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        // Network error / timeout: server unreachable. KEEP the token —
        // a blip must not log staff out; the login page explains the retry.
        // (Previously this branch wiped the token, forcing a full re-login
        // after every outage.)
      }
      setLoading(false);
    })();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (usernameOrEmail: string, passwordInput: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: usernameOrEmail.trim(), password: passwordInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid username/email or password.");
        return false;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user as StaffAccount);
      return true;
    } catch {
      setError("Unable to reach the server. Please try again.");
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    router.push("/login");
  }, [router]);

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === "admin";

  const changePassword = useCallback((newPassword: string) => {
    if (!user) return;

    const input: StaffAccountInput = {
      name: user.name,
      username: user.username,
      email: user.email,
      password: newPassword,
      role: user.role,
      status: user.status,
      availability: user.availability || "Offline",
    };

    updateStaffAccount(user.id, input);
  }, [user, updateStaffAccount]);

  const updateProfile = useCallback((name: string, email: string, username: string) => {
    if (!user) return;

    const input: StaffAccountInput = {
      name,
      username,
      email,
      role: user.role,
      status: user.status,
      availability: user.availability || "Offline",
    };

    updateStaffAccount(user.id, input);

    setUser({ ...user, name, email, username });
  }, [user, updateStaffAccount]);

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
