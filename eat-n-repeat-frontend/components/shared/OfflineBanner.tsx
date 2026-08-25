"use client";

import { useNetworkStatus } from "@/context/NetworkStatusContext";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOffline, isLocalBackendReachable } = useNetworkStatus();

  if (!isOffline || !isLocalBackendReachable) return null;

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-sm z-50 relative">
      {isOffline && isLocalBackendReachable && (
        <div className="flex items-center justify-center gap-2 text-amber-900 font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            <strong>Offline Café Mode:</strong> The café internet is currently unavailable. 
            Please connect to the café Wi-Fi to continue ordering locally.
          </span>
        </div>
      )}
    </div>
  );
}
