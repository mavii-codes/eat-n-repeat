"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { getApiUrl } from "@/lib/config";
import { 
  getPendingOfflineOrders, 
  getPendingStockTransactions, 
  markOrdersSynced, 
  clearSyncedOrders,
  markStockTransactionsSynced,
  clearSyncedStockTransactions
} from "@/lib/offlineSync";
import toast from "react-hot-toast";
import axios from "axios";

export type OnlineOrderingStatus = "AVAILABLE" | "UNAVAILABLE" | "LOCAL_ONLY";

type NetworkStatusContextType = {
  isOffline: boolean;
  isLocalBackendReachable: boolean;
  onlineOrdering: OnlineOrderingStatus;
};

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOffline: false,
  isLocalBackendReachable: true,
  onlineOrdering: "AVAILABLE",
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isLocalBackendReachable, setIsLocalBackendReachable] = useState(true);
  const [onlineOrdering, setOnlineOrdering] = useState<OnlineOrderingStatus>("AVAILABLE");
  const syncInProgress = useRef(false);
  // Tracks offline state across polls without stale-closure issues
  // (the interval below is mounted once).
  const wasOffline = useRef(false);

  const performSync = async () => {
    if (syncInProgress.current) return;

    try {
      syncInProgress.current = true;
      const offlineOrders = await getPendingOfflineOrders();
      const offlineStockTxs = await getPendingStockTransactions();

      if (offlineOrders.length === 0 && offlineStockTxs.length === 0) {
        return;
      }

      // /api/sync/offline requires a backend JWT. Prefer the staff token;
      // otherwise use the signed-in customer's token from our own NextAuth
      // session endpoint (same-origin, cookie-authenticated). Absent both,
      // keep the queue for later instead of failing loudly.
      let bearer: string | null =
        localStorage.getItem("eat-n-repeat-staff-token");
      if (!bearer) {
        try {
          const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
          if (sessionRes.ok) {
            const session = await sessionRes.json();
            if (typeof session?.accessToken === "string") bearer = session.accessToken;
          }
        } catch {
          // Session lookup is best-effort; queue survives regardless.
        }
      }
      if (!bearer) {
        console.warn("[sync] No auth token available; keeping offline queue for later.");
        return;
      }

      toast.loading("Syncing offline data...", { id: "sync-status" });

      const res = await axios.post(
        `${getApiUrl()}/api/sync/offline`,
        {
          offline_orders: offlineOrders,
          offline_stock_transactions: offlineStockTxs,
        },
        { headers: { Authorization: `Bearer ${bearer}` } }
      );

      if (res.data.success) {
        if (offlineOrders.length > 0) {
          await markOrdersSynced(offlineOrders.map((o: { id: string }) => o.id));
          await clearSyncedOrders();
        }
        if (offlineStockTxs.length > 0) {
          await markStockTransactionsSynced(offlineStockTxs.map((t: { id: string }) => t.id));
          await clearSyncedStockTransactions();
        }
        toast.success("Offline data synced successfully!", { id: "sync-status" });
      }
    } catch (err) {
      console.error("Auto-sync failed:", err);
      toast.error("Failed to sync offline data.", { id: "sync-status" });
    } finally {
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      wasOffline.current = false;
      setIsOffline(false);
      performSync();
    };
    
    const handleOffline = () => {
      wasOffline.current = true;
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    wasOffline.current = !navigator.onLine;
    setIsOffline(!navigator.onLine);
    if (navigator.onLine) {
      performSync();
    }

    const pingInterval = setInterval(async () => {
      if (navigator.onLine) {
        try {
          const res = await fetch(`${getApiUrl()}/api/sync/status`, {
            method: "GET",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            // Fail fast so a dead backend marks us offline in seconds,
            // never an endless hang.
            signal: AbortSignal.timeout(8000),
          });
          
          if (res.ok) {
            setIsLocalBackendReachable(true);
            // A successful poll proves this client can reach its backend,
            // so we are NOT offline — regardless of what the payload claims
            // about café→cloud liveness. The server's `isOffline` flag is
            // intentionally ignored here (backward-compat field only).
            if (wasOffline.current) {
              wasOffline.current = false;
              setIsOffline(false);
              performSync();
            } else {
              setIsOffline(false);
            }
            const data = await res.json();
            // Backward compat: treat missing onlineOrdering as AVAILABLE
            if (data.onlineOrdering === "UNAVAILABLE" || data.onlineOrdering === "LOCAL_ONLY" || data.onlineOrdering === "AVAILABLE") {
              setOnlineOrdering(data.onlineOrdering);
            } else {
              setOnlineOrdering("AVAILABLE");
            }
          } else {
            wasOffline.current = true;
            setIsOffline(true);
            setIsLocalBackendReachable(false);
          }
        } catch (err) {
          wasOffline.current = true;
          setIsOffline(true);
          setIsLocalBackendReachable(false);
        }
      }
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ isOffline, isLocalBackendReachable, onlineOrdering }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
