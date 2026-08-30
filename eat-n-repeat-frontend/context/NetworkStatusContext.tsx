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
  const syncInProgress = useRef(false);

  const performSync = async () => {
    if (syncInProgress.current) return;
    
    try {
      syncInProgress.current = true;
      const offlineOrders = await getPendingOfflineOrders();
      const offlineStockTxs = await getPendingStockTransactions();

      if (offlineOrders.length === 0 && offlineStockTxs.length === 0) {
        return;
      }

      toast.loading("Syncing offline data...", { id: "sync-status" });

      const res = await axios.post(`${getApiUrl()}/api/sync/offline`, {
        offline_orders: offlineOrders,
        offline_stock_transactions: offlineStockTxs,
      });

      if (res.data.success) {
        if (offlineOrders.length > 0) {
          await markOrdersSynced(offlineOrders.map(o => o.id));
          await clearSyncedOrders();
        }
        if (offlineStockTxs.length > 0) {
          await markStockTransactionsSynced(offlineStockTxs.map(t => t.id));
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
      setIsOffline(false);
      performSync();
    };
    
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
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
            headers: { "Content-Type": "application/json" }
          });
          
          if (res.ok) {
            setIsLocalBackendReachable(true);
            const data = await res.json();
            if (data.isOffline !== undefined && data.isOffline !== isOffline) {
              setIsOffline(data.isOffline);
              if (!data.isOffline) performSync();
            }
          } else {
            setIsLocalBackendReachable(false);
          }
        } catch (err) {
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
    <NetworkStatusContext.Provider value={{ isOffline, isLocalBackendReachable }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
