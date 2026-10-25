"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, WifiOff } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminForm";
import { DeliveryOrdersTable } from "@/components/admin/DeliveryOrdersTable";
import { AdminChatModal } from "@/components/admin/AdminChatModal";
import { useAdminData } from "@/context/AdminDataContext";
import { useNetworkStatus } from "@/context/NetworkStatusContext";
import { isLocalBackend, isDevOnlinePortal } from "@/lib/config";
import {
  activeDeliveryStatuses,
  historyDeliveryStatuses,
} from "@/lib/admin/delivery-utils";

type Tab = "all" | "active" | "history";

export default function DeliveryPage() {
  const {
    deliveryOrders,
    updateDeliveryStatus,
    archiveDeliveryOrder,
    getServiceAreaName,
    getActiveDeliveryOrders,
    getDeliveryHistory,
    refreshBackendOrders,
  } = useAdminData();

  const { isOffline } = useNetworkStatus();
  const isLocal = isLocalBackend() && !isDevOnlinePortal();
  const isDeliveryDisabled = isOffline || (isLocal && (typeof navigator !== "undefined" && !navigator.onLine));

  // Poll shared orders from backend on mount and every 10s so delivery status
  // updates made by Staff on other devices/tabs appear automatically.
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted && document.visibilityState === "visible") {
        refreshBackendOrders();
      }
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshBackendOrders]);

  const [tab, setTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<{ customerName: string; orderId: string; orderNumber: string } | null>(null);

  const handleOpenChat = (customerName: string, orderId: string, orderNumber: string) => {
    setActiveChatOrder({ customerName, orderId, orderNumber });
    setChatOpen(true);
  };

  const activeOrders = getActiveDeliveryOrders();
  const historyOrders = getDeliveryHistory();
  const activeDeliveryList = deliveryOrders.filter((order) => !order.archived);

  const displayedOrders = useMemo(() => {
    const base =
      tab === "active" ? activeOrders : tab === "history" ? historyOrders : activeDeliveryList;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q) ||
        order.items.toLowerCase().includes(q)
    );
  }, [tab, activeDeliveryList, activeOrders, historyOrders, searchQuery]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All Orders", count: activeDeliveryList.length },
    { id: "active", label: "Monitor Status", count: activeOrders.length },
    { id: "history", label: "Delivery History", count: historyOrders.length },
  ];

  return (
    <>
      <AdminPageHeader
        badge="Delivery"
        title="Delivery Orders"
        subtitle="View all delivery orders, monitor live status, and browse delivery history."
      />

      {isDeliveryDisabled && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <WifiOff className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-sm">Delivery is available online only</p>
            <p className="text-xs text-amber-700">
              Delivery tracking, assignment, status updates, and proof of delivery require an active internet connection. All delivery actions are disabled in offline / local mode.
            </p>
          </div>
        </div>
      )}

      <section className="mb-5 grid gap-5 sm:grid-cols-3">
        {[
          { label: "Active Deliveries", value: activeOrders.length },
          {
            label: "Out for Delivery",
            value: deliveryOrders.filter(
              (order) => order.status === "out_for_delivery",
            ).length,
          },
          { label: "Completed Today", value: historyOrders.length },
        ].map((stat) => (
          <div key={stat.label} className="admin-stat-card rounded-2xl p-5 pl-6">
            <p className="text-sm font-medium text-muted">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search order number, customer, address..."
          aria-label="Search delivery orders"
          className="w-full sm:max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/40 transition shadow-sm"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                : "border border-accent/10 bg-card text-muted hover:bg-accent-light hover:text-accent"
            }`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <AdminPanel
        title={
          tab === "all"
            ? "All Delivery Orders"
            : tab === "active"
              ? "Monitor Delivery Status"
              : "Delivery History"
        }
        subtitle={
          tab === "active"
            ? "Update order status as deliveries progress"
            : tab === "history"
              ? "Completed and cancelled deliveries"
              : "Full list of delivery orders"
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/delivery/settings"
              className="rounded-xl border border-accent/15 bg-white px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-light"
            >
              Fees & Areas
            </Link>
            <Link
              href="/admin/delivery/reports"
              className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-2.5 text-sm font-semibold text-white"
            >
              Delivery Reports
            </Link>
          </div>
        }
      >
        <DeliveryOrdersTable
          orders={displayedOrders}
          getServiceAreaName={getServiceAreaName}
          showStatusControl={tab === "active"}
          onStatusChange={updateDeliveryStatus}
          onChat={(order) => handleOpenChat(order.customerName, order.id, order.orderNumber)}
          disabled={isDeliveryDisabled}
          onArchive={
            tab === "history"
              ? (order) => {
                  if (confirm(`Archive delivery ${order.orderNumber}?`)) {
                    archiveDeliveryOrder(order.id);
                  }
                }
              : undefined
          }
        />
      </AdminPanel>

      {tab === "active" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {activeDeliveryStatuses.map((status) => (
            <div
              key={status}
              className="admin-panel rounded-xl px-4 py-3 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {status.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-lg font-semibold text-[#800000]">
                {
                  activeDeliveryList.filter((order) => order.status === status)
                    .length
                }
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {historyDeliveryStatuses.map((status) => (
            <div
              key={status}
              className="admin-panel rounded-xl px-4 py-3"
            >
              <p className="text-sm font-medium capitalize text-muted">
                {status} orders
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#800000]">
                {
                  activeDeliveryList.filter((order) => order.status === status)
                    .length
                }
              </p>
            </div>
          ))}
        </div>
      )}
      {activeChatOrder && (
        <AdminChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          customerName={activeChatOrder.customerName}
          orderId={activeChatOrder.orderId}
          orderNumber={activeChatOrder.orderNumber}
        />
      )}
    </>
  );
}
