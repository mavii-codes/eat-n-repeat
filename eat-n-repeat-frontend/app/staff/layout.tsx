"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";
import { ReviewsProvider } from "@/context/ReviewsContext";
import { StaffNotificationProvider } from "@/context/StaffNotificationContext";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="font-serif text-lg text-white/70">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <ReviewsProvider>
      <StaffNotificationProvider>
        <OnlineIndicator />
        {children}
      </StaffNotificationProvider>
    </ReviewsProvider>
  );
}
