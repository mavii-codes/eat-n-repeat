"use client";

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";
import { DashboardRecentOrders } from "@/components/admin/DashboardRecentOrders";
import {
  ClipboardIcon,
  DollarIcon,
  StatCard,
  TrendIcon,
} from "@/components/admin/StatCard";
import { dashboardStats, notifications } from "@/lib/admin/mock-data";

function formatChange(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value}% from yesterday`;
}

const quickLinks = [
  { href: "/admin/menu", label: "Menu Items", desc: "Manage menu" },
  { href: "/admin/stock", label: "Inventory", desc: "Stock control" },
  { href: "/admin/delivery", label: "Delivery", desc: "Orders & status" },
  { href: "/admin/archives", label: "Archives", desc: "Restore archived items" },
  { href: "/admin/reports", label: "Sales Reports", desc: "View sales" },
  { href: "/admin/staff", label: "Staff", desc: "Team accounts" },
  { href: "/admin/settings", label: "Settings", desc: "System config" },
];

export default function AdminDashboardPage() {
  const stats = dashboardStats;

  return (
    <>
      <AdminPageHeader
        badge="Owner Portal"
        title="Admin Dashboard"
        subtitle="Monitor sales, orders, notifications, and jump into management tools."
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
          title="Orders Today"
          value={stats.ordersToday.toLocaleString()}
          subtitle={formatChange(stats.ordersChange)}
          icon={<ClipboardIcon />}
          tone="red"
        />
        <StatCard
          title="Completed"
          value={stats.completedOrders.toLocaleString()}
          subtitle={`${stats.pendingOrders} pending`}
          icon={<TrendIcon />}
          tone="rose"
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="admin-panel rounded-2xl p-6">
            <h2 className="font-serif text-xl font-semibold text-[#800000]">
              Quick Access
            </h2>
            <p className="mt-1 text-sm text-muted">
              Jump to admin management sections
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-accent/10 bg-accent-light/40 px-4 py-4 transition-colors hover:bg-accent-light"
                >
                  <p className="font-semibold text-[#800000]">{link.label}</p>
                  <p className="mt-1 text-xs text-muted">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <NotificationsPanel notifications={notifications} />
        </div>
      </section>

      <section className="mt-5">
        <DashboardRecentOrders />
      </section>
    </>
  );
}
