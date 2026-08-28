"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminData } from "@/context/AdminDataContext";
import type { StaffAccount, StaffAccountInput } from "@/lib/admin/types";

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
  const { staffAccounts, updateStaffAccount } = useAdminData();
  const router = useRouter();

  // Load session from local storage and verify with backend
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const token = localStorage.getItem('eat-n-repeat-staff-token');
      const storedSession = localStorage.getItem(SESSION_KEY);
      
      if (!token) {
        if (storedSession) {
          localStorage.removeItem(SESSION_KEY);
        }
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { getApiUrl } = await import('@/lib/config');
        const res = await fetch(`${getApiUrl()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setUser(data.user);
            localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
          }
        } else {
          localStorage.removeItem('eat-n-repeat-staff-token');
          localStorage.removeItem(SESSION_KEY);
          if (mounted) setUser(null);
        }
      } catch (e) {
        // Network error, fallback to local session if exists
        if (storedSession && mounted) {
          try {
            setUser(JSON.parse(storedSession));
          } catch {}
        }
      }
      if (mounted) setLoading(false);
    };
    checkSession();
    return () => { mounted = false; };
  }, []);

  const clearError = () => setError(null);

  const login = async (usernameOrEmail: string, passwordInput: string): Promise<boolean> => {
    setError(null);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const res = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: usernameOrEmail.trim(), password: passwordInput })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.message || "Invalid credentials.");
        return false;
      }
      
      setUser(data.user);
      localStorage.setItem('eat-n-repeat-staff-token', data.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      return true;
    } catch (e) {
      console.error("Login error:", e);
      setError("Network error. Please try again.");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('eat-n-repeat-staff-token');
    router.push("/login");
  };

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === "admin";

  const changePassword = (newPassword: string) => {
    if (!user) return;

    const input: StaffAccountInput = {
      ...user,
      password: newPassword,
    };

    updateStaffAccount(user.id, input);

    const updatedUser = { ...user, password: newPassword };
    setUser(updatedUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
  };

  const updateProfile = (name: string, email: string, username: string) => {
    if (!user) return;

    const input: StaffAccountInput = {
      ...user,
      name,
      username,
      email,
      password: user.password || "staff123",
    };

    updateStaffAccount(user.id, input);

    const updatedUser = { ...user, name, email, username };
    setUser(updatedUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
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
