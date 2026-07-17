"use client";

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
  const { getActiveStoreOrders, archiveStoreOrder } = useAdminData();
  const storeOrders = getActiveStoreOrders();
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
        <RecentOrdersTable
          orders={storeOrders}
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
