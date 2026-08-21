"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/config";

type NetworkStatusContextType = {
  isOffline: boolean;
  isLocalBackendReachable: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOffline: false,
  isLocalBackendReachable: true,
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isLocalBackendReachable, setIsLocalBackendReachable] = useState(true);

  useEffect(() => {
    // Basic browser online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOffline(!navigator.onLine);

    // Advanced: Ping backend to see if we have actual connection to our local server
    // and let the backend tell us if IT has internet (optional next step)
    const pingInterval = setInterval(async () => {
      try {
        // We ping a lightweight endpoint on the backend
        const res = await fetch(`${getApiUrl()}/api/sync/status`, {
          method: "GET",
          cache: "no-store",
          headers: { "Content-Type": "application/json" }
        });
        
        if (res.ok) {
          setIsLocalBackendReachable(true);
          const data = await res.json();
          // The backend tells us if it can reach the cloud
          if (data.isOffline !== undefined) {
            setIsOffline(data.isOffline);
          }
        } else {
          setIsLocalBackendReachable(false);
        }
      } catch (err) {
        setIsLocalBackendReachable(false);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ isOffline, isLocalBackendReachable }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
