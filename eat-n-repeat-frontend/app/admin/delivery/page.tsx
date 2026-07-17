"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminForm";
import { DeliveryOrdersTable } from "@/components/admin/DeliveryOrdersTable";
import { AdminChatModal } from "@/components/admin/AdminChatModal";
import { useAdminData } from "@/context/AdminDataContext";
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
  } = useAdminData();

  const [tab, setTab] = useState<Tab>("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<{ customerName: string; orderNumber: string } | null>(null);

  const handleOpenChat = (customerName: string, orderNumber: string) => {
    setActiveChatOrder({ customerName, orderNumber });
    setChatOpen(true);
  };

  const activeOrders = getActiveDeliveryOrders();
  const historyOrders = getDeliveryHistory();
  const activeDeliveryList = deliveryOrders.filter((order) => !order.archived);

  const displayedOrders = useMemo(() => {
    if (tab === "active") return activeOrders;
    if (tab === "history") return historyOrders;
    return activeDeliveryList;
  }, [tab, activeDeliveryList, activeOrders, historyOrders]);

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
          onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}
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
          orderId={activeChatOrder.orderNumber}
        />
      )}
    </>
  );
}
