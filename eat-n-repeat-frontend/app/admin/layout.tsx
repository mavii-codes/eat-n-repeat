"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "admin") {
        router.replace("/staff");
      }
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="font-serif text-lg text-white/70">Verifying Admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen">
      <OnlineIndicator />
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      <div className="relative z-10 lg:pl-72">
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
