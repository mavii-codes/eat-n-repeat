"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLocalBackend, isDevOnlinePortal } from "@/lib/config";

/**
 * Ensures the Customer Portal is only accessible in the Online environment.
 * If accessed on the local/offline system (e.g. LAN IP or local dev without
 * online dev flag), it immediately redirects the browser to the Staff / Admin
 * Portal login (/login).
 */
export function OfflineCustomerGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (isLocalBackend() && !isDevOnlinePortal()) {
      setIsBlocked(true);
      router.replace("/login");
    }
  }, [router]);

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] text-stone-700">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#800000] border-t-transparent"></div>
          <p className="text-sm font-semibold">Redirecting to Staff / Admin Portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
