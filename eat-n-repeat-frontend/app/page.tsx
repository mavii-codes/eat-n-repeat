"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/staff");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="admin-shell min-h-screen flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
        <p className="font-serif text-lg text-white/70">Redirecting...</p>
      </div>
    </div>
  );
}
