"use client";

import { useEffect, useMemo, useState } from "react";
import { PhilippinePeso, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LiveChip } from "@/components/admin/LiveChip";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";
import { SalesChart } from "@/components/admin/SalesChart";
import {
  ClipboardIcon,
  StatCard,
  TrendIcon,
} from "@/components/admin/StatCard";
import { useAdminData } from "@/context/AdminDataContext";
import { peso } from "@/lib/admin/inventory-utils";
import {
  formatPctChange,
  pctChangeToneClassName,
} from "@/lib/admin/sales-format";

/* ── Expenses & Net strip (additive, Phase B) ── */

const STRIP_CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const STRIP_HEAD = "p-4 border-b border-stone-100 flex flex-wrap justify-between items-center bg-stone-50/50 gap-3";

type ExpensePeriod = "today" | "week" | "year";

/** Wall-clock Date in Asia/Manila (PH is fixed UTC+8, no DST). */
function phWallNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

function phYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function periodRange(period: ExpensePeriod): { from: string; to: string } {
  const now = phWallNow();
  const today = phYmd(now);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    // Monday-start current week, in PH wall time.
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return { from: phYmd(monday), to: today };
  }
  return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
}

const PERIOD_LABELS: { value: ExpensePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "year", label: "This Year" },
];

export default function ReportsPage() {
  const {
    getActiveStoreOrders,
    archiveStoreOrder,
    refreshBackendOrders,
    fetchExpensesSummary,
    salesFigures,
    salesEventsVersion,
    fetchSalesFigures,
  } = useAdminData();
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

  // Real, backend-backed revenue bundle (shared with the dashboard context).
  // Sales figures refresh at the context level; the event version below is
  // only used to refetch this page's scoped expenses summary.
  useEffect(() => {
    if (!salesFigures) void fetchSalesFigures();
  }, [salesFigures, fetchSalesFigures]);

  const weeklyTotal = salesFigures?.weeklyTotal ?? 0;
  const monthlyTotal = salesFigures?.monthlyTotal ?? 0;
  const yearlyTotal = salesFigures?.yearlyTotal ?? 0;
  const changePct = salesFigures?.changePct ?? null;

  // Expenses & Net strip — summary fetched on mount, on period toggle, and
  // after each debounced admin event (same dates, no new intervals).
  const [expensePeriod, setExpensePeriod] = useState<ExpensePeriod>("today");
  const [expenseSummary, setExpenseSummary] = useState<{ total: number; count: number } | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setExpensesLoading(true);
    const { from, to } = periodRange(expensePeriod);
    fetchExpensesSummary(from, to).then((s) => {
      if (!mounted) return;
      setExpenseSummary(s ?? { total: 0, count: 0 });
      setExpensesLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [expensePeriod, fetchExpensesSummary, salesEventsVersion]);

  const salesShown =
    expensePeriod === "today"
      ? Number(salesFigures?.today.revenue) || 0
      : expensePeriod === "week"
        ? weeklyTotal
        : yearlyTotal;
  const expensesTotal = expenseSummary?.total ?? 0;
  const netSales = salesShown - expensesTotal;
  const netLabel = netSales < 0 ? `-₱${Math.abs(netSales).toFixed(2)}` : `₱${netSales.toFixed(2)}`;

  return (
    <>
      <AdminPageHeader
        badge="Reports"
        title="Reports & Sales"
        subtitle="View sales performance, revenue summaries, and order reports."
        action={<LiveChip />}
      />

      <section className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Today's Revenue"
          value={`₱${Number(salesFigures?.today.revenue || 0).toLocaleString()}`}
          subtitle={formatPctChange(changePct)}
          subtitleClassName={pctChangeToneClassName(changePct)}
          icon={<PhilippinePeso className="h-5 w-5" />}
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
          subtitle={`This month: ₱${monthlyTotal.toLocaleString()}`}
          icon={<TrendIcon />}
          tone="rose"
        />
      </section>

      {/* ── Expenses & Net (additive strip) ── */}
      <section className="mt-5">
        <div className={STRIP_CARD}>
          <div className={STRIP_HEAD}>
            <div className="flex items-center gap-2">
              <PhilippinePeso className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-stone-800">Expenses &amp; Net</h2>
            </div>
            {/* Segmented toggle, styled like the SalesChart view switch */}
            <div className="inline-flex rounded-xl border border-accent/10 bg-accent-light/50 p-1">
              {PERIOD_LABELS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpensePeriod(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    expensePeriod === option.value
                      ? "bg-gradient-to-r from-accent to-accent-dark text-white shadow-sm"
                      : "text-accent hover:bg-white/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
            <div className="p-2 sm:pr-4">
              <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">
                Total Expenses
              </p>
              <p className="font-serif text-2xl font-bold text-amber-700">
                {expensesLoading ? "…" : peso(expensesTotal)}
              </p>
              <p className="text-[11px] font-semibold text-stone-400 mt-1">
                {expensesLoading
                  ? "—"
                  : expenseSummary && expenseSummary.count > 0
                    ? `${Number(expenseSummary.count).toLocaleString("en-PH")} expense ${Number(expenseSummary.count) === 1 ? "entry" : "entries"} (active)`
                    : "No expenses recorded for this period."}
              </p>
            </div>
            <div className="p-2 sm:pl-4">
              <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">
                Net (Sales − Expenses)
              </p>
              <p className="font-serif text-2xl font-bold text-[#800000]">
                {expensesLoading ? "…" : netLabel}
              </p>
              <p className="text-[11px] font-semibold text-stone-400 mt-1">
                Live — updates in real time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Discounts strip (additive, promo codes) ──
          Hidden until a discount actually exists, so an unused feature
          never adds noise. Week rows aren't available from the backend
          figures bundle, so the strip covers today / month / year. */}
      {(() => {
        const todayDiscount = Number(salesFigures?.today.totalDiscounts) || 0;
        const todayGross = Number(salesFigures?.today.grossBeforeDiscounts) || 0;
        const monthDiscount = Number(salesFigures?.monthlyTotalDiscounts) || 0;
        const monthGross = Number(salesFigures?.monthlyGrossBeforeDiscounts) || 0;
        const yearDiscount = Number(salesFigures?.yearlyTotalDiscounts) || 0;
        const yearGross = Number(salesFigures?.yearlyGrossBeforeDiscounts) || 0;
        const anyDiscount = todayDiscount > 0 || monthDiscount > 0 || yearDiscount > 0;
        if (!anyDiscount) return null;
        return (
          <section className="mt-5">
            <div className={STRIP_CARD}>
              <div className={STRIP_HEAD}>
                <div className="flex items-center gap-2">
                  <PhilippinePeso className="h-5 w-5 text-amber-600" />
                  <h2 className="font-bold text-stone-800">Discounts (Promo Codes)</h2>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
                <div className="p-2 sm:pr-4">
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">
                    Today
                  </p>
                  <p className="font-serif text-xl font-bold text-emerald-700">
                    Total discounts: {peso(todayDiscount)}
                  </p>
                  <p className="text-[11px] font-semibold text-stone-400 mt-1">
                    Gross sales (before discounts): {peso(todayGross)}
                  </p>
                </div>
                <div className="p-2 sm:px-4">
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">
                    This Month
                  </p>
                  <p className="font-serif text-xl font-bold text-emerald-700">
                    Total discounts: {peso(monthDiscount)}
                  </p>
                  <p className="text-[11px] font-semibold text-stone-400 mt-1">
                    Gross sales (before discounts): {peso(monthGross)}
                  </p>
                </div>
                <div className="p-2 sm:pl-4">
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">
                    This Year
                  </p>
                  <p className="font-serif text-xl font-bold text-emerald-700">
                    Total discounts: {peso(yearDiscount)}
                  </p>
                  <p className="text-[11px] font-semibold text-stone-400 mt-1">
                    Gross sales (before discounts): {peso(yearGross)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      <section className="mt-5">
        <SalesChart
          monthlyData={salesFigures?.monthly ?? []}
          weeklyData={salesFigures?.weekly ?? []}
        />
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
