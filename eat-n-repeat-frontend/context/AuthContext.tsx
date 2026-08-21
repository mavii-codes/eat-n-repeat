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

  // Load session from local storage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const parsedUser = JSON.parse(storedSession) as StaffAccount;
        // Verify user still exists, is active, and is not archived in the master admin list
        const activeStaff = staffAccounts.find(
          (acc) => acc.id === parsedUser.id && !acc.archived && acc.status === "active"
        );
        if (activeStaff) {
          setUser(activeStaff);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, [staffAccounts]);

  const clearError = () => setError(null);

  const login = async (usernameOrEmail: string, passwordInput: string): Promise<boolean> => {
    setError(null);
    console.log("LOGIN ATTEMPT:", { usernameOrEmail, passwordInput, staffAccounts });
    // Find account
    const matchedAccount = staffAccounts.find(
      (acc) =>
        (acc.username?.toLowerCase() === usernameOrEmail.trim().toLowerCase() ||
          acc.email?.toLowerCase() === usernameOrEmail.trim().toLowerCase()) &&
        !acc.archived
    );

    if (!matchedAccount) {
      setError("Invalid credentials or unauthorized account.");
      return false;
    }

    if (matchedAccount.status !== "active") {
      setError("Invalid credentials or unauthorized account.");
      return false;
    }

    // Verify password
    if (matchedAccount.password !== passwordInput) {
      setError("Invalid credentials or unauthorized account.");
      return false;
    }

    // Set user
    setUser(matchedAccount);
    localStorage.setItem(SESSION_KEY, JSON.stringify(matchedAccount));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
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
