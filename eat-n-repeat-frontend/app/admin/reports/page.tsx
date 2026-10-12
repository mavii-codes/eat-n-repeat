"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";
import { SalesChart } from "@/components/admin/SalesChart";
import {
  ClipboardIcon,
  DollarIcon,
  StatCard,
  TrendIcon,
} from "@/components/admin/StatCard";
import { useAdminData } from "@/context/AdminDataContext";
import {
  dashboardStats,
  monthlySales,
  weeklySales,
} from "@/lib/admin/mock-data";

function formatChange(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value}% from yesterday`;
}

export default function ReportsPage() {
  const stats = dashboardStats;
  const { getActiveStoreOrders, archiveStoreOrder, refreshBackendOrders } = useAdminData();
  const storeOrders = getActiveStoreOrders();
  const [searchQuery, setSearchQuery] = useState("");
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return storeOrders;
    return storeOrders.filter(
      (order) =>
        order.orderId.toLowerCase().includes(q) ||
        (order.customerName ?? "").toLowerCase().includes(q) ||
        order.items.toLowerCase().includes(q)
    );
  }, [storeOrders, searchQuery]);

  // Pull shared orders from the backend on mount and every 20s while this
  // tab is visible, so this page no longer depends on someone having visited
  // /staff first. Reuses the existing fetch: silent on auth/network failure
  // (offline mode keeps the local cache), same cadence as the staff page.
  useEffect(() => {
    let mounted = true;
    refreshBackendOrders();
    const interval = setInterval(() => {
      if (mounted && document.visibilityState === "visible") refreshBackendOrders();
    }, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshBackendOrders]);
  const yearlyTotal = monthlySales.reduce((sum, item) => sum + item.amount, 0);
  const weeklyTotal = weeklySales.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <AdminPageHeader
        badge="Reports"
        title="Reports & Sales"
        subtitle="View sales performance, revenue summaries, and order reports."
      />

      <section className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Today's Revenue"
          value={`₱${stats.todaysRevenue.toLocaleString()}`}
          subtitle={formatChange(stats.revenueChange)}
          icon={<DollarIcon />}
          tone="wine"
        />
        <StatCard
          title="Weekly Sales"
          value={`₱${weeklyTotal.toLocaleString()}`}
          subtitle="Current week total"
          icon={<ClipboardIcon />}
          tone="red"
        />
        <StatCard
          title="Yearly Sales"
          value={`₱${yearlyTotal.toLocaleString()}`}
          subtitle="All months combined"
          icon={<TrendIcon />}
          tone="rose"
        />
      </section>

      <section className="mt-5">
        <SalesChart monthlyData={monthlySales} weeklyData={weeklySales} />
      </section>

      <section className="mt-5">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order ID, customer, items..."
            aria-label="Search orders"
            className="w-full sm:max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/40 transition shadow-sm"
          />
        </div>
        <RecentOrdersTable
          orders={filteredOrders}
          onArchive={(order) => {
            if (confirm(`Archive order ${order.orderId}?`)) {
              archiveStoreOrder(order.id);
            }
          }}
        />
      </section>
    </>
  );
}
