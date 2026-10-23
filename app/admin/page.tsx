"use client";

import Link from "next/link";
import { PhilippinePeso } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NotificationsPanel } from "@/components/admin/NotificationsPanel";
import { DashboardRecentOrders } from "@/components/admin/DashboardRecentOrders";
import { LiveChip } from "@/components/admin/LiveChip";
import {
  ClipboardIcon,
  StatCard,
  TrendIcon,
} from "@/components/admin/StatCard";
import { useEffect, useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import {
  formatPctChange,
  pctChangeToneClassName,
} from "@/lib/admin/sales-format";
import type { AdminNotification } from "@/lib/admin/types";

const quickLinks = [
  { href: "/admin/menu", label: "Menu Items", desc: "Manage menu" },
  { href: "/admin/inventory", label: "Inventory", desc: "Stock value & movements" },
  { href: "/admin/delivery", label: "Delivery", desc: "Orders & status" },
  { href: "/admin/archives", label: "Archives", desc: "Restore archived items" },
  { href: "/admin/reports", label: "Sales Reports", desc: "View sales" },
  { href: "/admin/users/staff", label: "Staff", desc: "Team accounts" },
  { href: "/admin/settings", label: "Settings", desc: "System config" },
];

function timeAgo(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function AdminDashboardPage() {
  const {
    stockItems,
    deliveryOrders,
    refreshBackendOrders,
    refreshBackendStock,
    salesFigures,
    salesEventsVersion,
    fetchSalesFigures,
  } = useAdminData();

  // Real, backend-backed revenue bundle. The provider fetches once on mount;
  // this covers a direct page mount and every debounced SSE bump.
  useEffect(() => {
    if (!salesFigures) void fetchSalesFigures();
  }, [salesFigures, fetchSalesFigures]);

  useEffect(() => {
    if (salesEventsVersion === 0) return;
    void fetchSalesFigures();
  }, [salesEventsVersion, fetchSalesFigures]);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted && document.visibilityState === "visible") {
        refreshBackendOrders();
        refreshBackendStock();
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
  }, [refreshBackendOrders, refreshBackendStock]);

  const today = salesFigures?.today;
  const changePct = salesFigures?.changePct ?? null;
  const notifications = useMemo<AdminNotification[]>(() => {
    const lowStock = stockItems
      .filter((item) => item.quantity <= item.lowStockThreshold)
      .map((item) => ({
        id: `low-stock-${item.id}`,
        type: "low_stock" as const,
        title: `Low stock: ${item.name} (${item.quantity} ${item.unit} left)`,
        timestamp: "Needs attention",
      }));

    const newOrders = deliveryOrders
      .filter((order) => !order.archived && ["pending", "confirmed"].includes(order.status))
      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      .map((order) => ({
        id: `delivery-${order.id}`,
        type: "new_order" as const,
        title: `Delivery order ${order.orderNumber}: ${order.status.replace("_", " ")}`,
        timestamp: timeAgo(order.orderedAt),
      }));

    return [...lowStock, ...newOrders].slice(0, 5);
  }, [stockItems, deliveryOrders]);

  return (
    <>
      <AdminPageHeader
        badge="Owner Portal"
        title="Admin Dashboard"
        subtitle="Monitor sales, orders, notifications, and jump into management tools."
        action={<LiveChip />}
      />

      <section className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Today's Revenue"
          value={`₱${Number(today?.revenue || 0).toLocaleString()}`}
          subtitle={formatPctChange(changePct)}
          subtitleClassName={pctChangeToneClassName(changePct)}
          icon={<PhilippinePeso className="h-5 w-5" />}
          tone="wine"
        />
        <StatCard
          title="Orders Today"
          value={Number(today?.orders || 0).toLocaleString()}
          subtitle={`${Number(today?.pending || 0)} in progress`}
          icon={<ClipboardIcon />}
          tone="red"
        />
        <StatCard
          title="Completed"
          value={Number(today?.completed || 0).toLocaleString()}
          subtitle={`${Number(today?.pending || 0)} pending`}
          icon={<TrendIcon />}
          tone="rose"
        />
      </section>

      {/* ── Promo discounts today (additive, promo codes) ──
          Hidden until a discount actually exists, so an unused feature
          never adds noise. */}
      {(Number(today?.totalDiscounts) || 0) > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <p className="text-xs font-bold text-emerald-800">
            Total discounts today: ₱{Number(today?.totalDiscounts).toFixed(2)}
          </p>
          <p className="text-[11px] font-semibold text-emerald-700/80 mt-0.5">
            Gross sales (before discounts): ₱{Number(today?.grossBeforeDiscounts).toFixed(2)}
          </p>
        </div>
      )}

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
