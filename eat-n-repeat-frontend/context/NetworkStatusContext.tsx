"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { getApiUrl } from "@/lib/config";
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";
import {
  getPendingOfflineOrders,
  getPendingStockTransactions,
  getPendingOfflinePayments,
  getPendingOfflineExpenses,
  getPendingOfflineStatusChanges,
  getPendingOfflineShiftOps,
  markOrdersSynced,
  clearSyncedOrders,
  markStockTransactionsSynced,
  clearSyncedStockTransactions,
  markPaymentsSynced,
  clearSyncedOfflinePayments,
  markExpensesSynced,
  clearSyncedOfflineExpenses,
  markStatusChangesSynced,
  clearSyncedOfflineStatusChanges,
  markShiftOpsSynced,
  clearSyncedOfflineShiftOps,
  reviewLegacyCustomerOfflineOrders,
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
  const wasOffline = useRef(false);
  const consecutivePingsRef = useRef(0);

  const performSync = async () => {
    if (syncInProgress.current) return;

    try {
      syncInProgress.current = true;
      const offlineOrders = await getPendingOfflineOrders();
      const offlineStockTxs = await getPendingStockTransactions();
      const offlinePayments = await getPendingOfflinePayments();
      const offlineExpenses = await getPendingOfflineExpenses();
      const offlineStatusChanges = await getPendingOfflineStatusChanges();
      const offlineShiftOps = await getPendingOfflineShiftOps();

      if (
        offlineOrders.length === 0 &&
        offlineStockTxs.length === 0 &&
        offlinePayments.length === 0 &&
        offlineExpenses.length === 0 &&
        offlineStatusChanges.length === 0 &&
        offlineShiftOps.length === 0
      ) {
        return;
      }

      // Offline sync is strictly for staff operations. Require staff/admin token.
      const bearer = getStaffOrAdminToken();
      if (!bearer) {
        console.warn("[sync] Staff credentials required to drain offline operations; queue preserved.");
        return;
      }

      toast.loading("Syncing offline data...", { id: "sync-status" });

      const res = await axios.post(
        `${getApiUrl()}/api/sync/offline`,
        {
          offline_orders: offlineOrders,
          offline_stock_transactions: offlineStockTxs,
          offline_payments: offlinePayments,
          offline_expenses: offlineExpenses,
          offline_status_changes: offlineStatusChanges,
          offline_shifts: offlineShiftOps,
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
        if (offlinePayments.length > 0) {
          await markPaymentsSynced(offlinePayments.map((p: { orderId: string }) => p.orderId));
          await clearSyncedOfflinePayments();
        }
        if (offlineExpenses.length > 0) {
          await markExpensesSynced(offlineExpenses.map((e: { id: string }) => e.id));
          await clearSyncedOfflineExpenses();
        }
        if (offlineStatusChanges.length > 0) {
          await markStatusChangesSynced(offlineStatusChanges.map((s: { orderId: string }) => s.orderId));
          await clearSyncedOfflineStatusChanges();
        }
        if (offlineShiftOps.length > 0) {
          await markShiftOpsSynced(offlineShiftOps.map((s: { shiftId: string }) => s.shiftId));
          await clearSyncedOfflineShiftOps();
        }
        toast.success("Offline data synced successfully!", { id: "sync-status" });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("eat-n-repeat:offline-synced"));
        }
      }
    } catch (err) {
      console.error("Auto-sync failed:", err);
      toast.error("Failed to sync offline data.", { id: "sync-status" });
    } finally {
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    // Audit existing browser queue on mount without purging
    reviewLegacyCustomerOfflineOrders().catch(() => {});

    const handleOnline = () => {
      // Don't flip immediately to prevent flapping; probe liveness first
      consecutivePingsRef.current = 1;
    };
    
    const handleOffline = () => {
      consecutivePingsRef.current = 0;
      wasOffline.current = true;
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    wasOffline.current = !navigator.onLine;
    setIsOffline(!navigator.onLine);
    if (navigator.onLine) {
      consecutivePingsRef.current = 1;
      performSync();
    }

    const pingInterval = setInterval(async () => {
      if (navigator.onLine) {
        try {
          const res = await fetch(`${getApiUrl()}/api/sync/status`, {
            method: "GET",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          
          if (res.ok) {
            setIsLocalBackendReachable(true);
            consecutivePingsRef.current += 1;

            // Flapping protection: require at least 2 consecutive successful probes
            if (wasOffline.current) {
              if (consecutivePingsRef.current >= 2) {
                wasOffline.current = false;
                setIsOffline(false);
                performSync();
              }
            } else {
              setIsOffline(false);
            }

            const data = await res.json();
            if (data.onlineOrdering === "UNAVAILABLE" || data.onlineOrdering === "LOCAL_ONLY" || data.onlineOrdering === "AVAILABLE") {
              setOnlineOrdering(data.onlineOrdering);
            } else {
              setOnlineOrdering("AVAILABLE");
            }
          } else {
            consecutivePingsRef.current = 0;
            wasOffline.current = true;
            setIsOffline(true);
            setIsLocalBackendReachable(false);
          }
        } catch {
          consecutivePingsRef.current = 0;
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
