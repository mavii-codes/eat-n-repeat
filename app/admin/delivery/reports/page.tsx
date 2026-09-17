"use client";

import { useMemo, useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import {
  deliveryStatusLabels,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import type { DeliveryOrder } from "@/lib/admin/types";
import { getApiUrl } from "@/lib/config";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart
} from "recharts";

type DateRange = "today" | "this_week" | "this_month" | "custom";

export default function DeliveryReportsPage() {
  const { serviceAreas, getServiceAreaName, deliveryOrders } = useAdminData();
  const [isLoading, setIsLoading] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const orders = deliveryOrders || [];

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.archived) return false;
      
      const orderDate = new Date(order.orderedAt);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateRange === "today") {
        return orderDate >= startOfToday;
      } else if (dateRange === "this_week") {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return orderDate >= startOfWeek;
      } else if (dateRange === "this_month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return orderDate >= startOfMonth;
      } else if (dateRange === "custom") {
        if (customStart && orderDate < new Date(customStart)) return false;
        if (customEnd) {
          const end = new Date(customEnd);
          end.setDate(end.getDate() + 1);
          if (orderDate >= end) return false;
        }
        return true;
      }
      return true;
    });
  }, [orders, dateRange, customStart, customEnd]);

  const report = useMemo(() => {
    const activeOrders = filteredOrders;
    const delivered = activeOrders.filter((order) => order.status === "delivered");
    const cancelled = activeOrders.filter((order) => order.status === "cancelled");
    const totalRevenue = delivered.reduce((sum, order) => sum + order.total, 0);
    
    const freeDeliveriesCount = delivered.filter(o => o.deliveryFee === 0).length;
    const paidDeliveriesCount = delivered.filter(o => o.deliveryFee > 0).length;
    const totalFees = delivered.reduce((sum, order) => sum + order.deliveryFee, 0);
    
    const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;

    const completedOrCancelled = delivered.length + cancelled.length;
    const successRate = completedOrCancelled > 0 ? Math.round((delivered.length / completedOrCancelled) * 100) : 0;
    const cancellationRate = completedOrCancelled > 0 ? Math.round((cancelled.length / completedOrCancelled) * 100) : 0;

    const deliveryTimes = delivered
      .filter(o => o.outForDeliveryAt && o.deliveredAt)
      .map(o => {
        const start = new Date(o.outForDeliveryAt!).getTime();
        const end = new Date(o.deliveredAt!).getTime();
        return Math.max(0, Math.round((end - start) / 60000));
      });

    const avgTime = deliveryTimes.length ? `${Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)} min` : "No completed deliveries";
    const fastestTime = deliveryTimes.length ? `${Math.min(...deliveryTimes)} min` : "—";
    const longestTime = deliveryTimes.length ? `${Math.max(...deliveryTimes)} min` : "—";

    const byArea = serviceAreas.map((area) => {
      const areaOrders = activeOrders.filter((order) => order.serviceAreaId === area.id);
      const areaDelivered = areaOrders.filter((order) => order.status === "delivered");
      
      const areaFree = areaDelivered.filter(o => o.deliveryFee === 0).length;
      const areaPaid = areaDelivered.filter(o => o.deliveryFee > 0).length;

      return {
        areaId: area.id,
        name: area.name,
        totalOrders: areaOrders.length,
        delivered: areaDelivered.length,
        freeDeliveries: areaFree,
        paidDeliveries: areaPaid,
        foodRevenue: areaDelivered.reduce((sum, order) => sum + order.subtotal, 0),
        fees: areaDelivered.reduce((sum, order) => sum + order.deliveryFee, 0),
        totalRevenue: areaDelivered.reduce((sum, order) => sum + order.total, 0),
      };
    }).sort((a, b) => b.delivered - a.delivered);

    const byStatus = Object.keys(deliveryStatusLabels).map((status) => {
      const count = activeOrders.filter((order) => order.status === status).length;
      const percentage = activeOrders.length > 0 ? Math.round((count / activeOrders.length) * 100) : 0;
      return { status, count, percentage };
    });

    const cancellationReasons = {
      "Customer Cancelled": cancelled.filter(o => o.cancelledBy === "CUSTOMER").length,
      "Staff Cancelled": cancelled.filter(o => o.cancelledBy === "STAFF").length,
      "Payment Failed": cancelled.filter(o => o.paymentStatus === "failed").length,
      "Other": cancelled.filter(o => !o.cancelledBy && o.paymentStatus !== "failed").length
    };
    
    const cancellationSummary = Object.entries(cancellationReasons).map(([reason, count]) => ({
      reason,
      count,
      percentage: cancelled.length > 0 ? Math.round((count / cancelled.length) * 100) : 0
    })).filter(c => c.count > 0);

    // Chart Data Generation
    const chartDataMap = new Map<string, { date: string, orders: number, revenue: number }>();
    delivered.forEach(order => {
        const d = new Date(order.deliveredAt || order.orderedAt);
        const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!chartDataMap.has(dateKey)) {
            chartDataMap.set(dateKey, { date: dateKey, orders: 0, revenue: 0 });
        }
        const entry = chartDataMap.get(dateKey)!;
        entry.orders += 1;
        entry.revenue += order.total;
    });
    const chartData = Array.from(chartDataMap.values()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      totalOrders: activeOrders.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      totalRevenue,
      totalFees,
      avgOrderValue,
      freeDeliveriesCount,
      paidDeliveriesCount,
      successRate,
      cancellationRate,
      avgTime,
      fastestTime,
      longestTime,
      byArea,
      byStatus,
      cancellationSummary,
      chartData,
      recentDelivered: delivered.slice(0, 5),
    };
  }, [filteredOrders, serviceAreas]);

  function handleExport() {
    const lines = [
      "Eat n' Repeat — Delivery Report",
      `Generated: ${new Date().toLocaleString("en-PH")}`,
      `Date Range: ${dateRange === 'custom' ? `${customStart} to ${customEnd}` : dateRange.replace('_', ' ').toUpperCase()}`,
      "",
      "--- SUMMARY ---",
      `Total Orders: ${report.totalOrders}`,
      `Delivered: ${report.delivered}`,
      `Cancelled: ${report.cancelled}`,
      `Free Deliveries: ${report.freeDeliveriesCount}`,
      `Paid Deliveries: ${report.paidDeliveriesCount}`,
      `Total Revenue: ₱${report.totalRevenue}`,
      `Delivery Fees Collected: ₱${report.totalFees}`,
      `Average Order Value: ₱${report.avgOrderValue}`,
      "",
      "--- PERFORMANCE ---",
      `Success Rate: ${report.successRate}%`,
      `Average Delivery Time: ${report.avgTime}`,
      `Fastest Delivery: ${report.fastestTime}`,
      `Longest Delivery: ${report.longestTime}`,
      "",
      "--- REVENUE BY SERVICE AREA ---",
      ...report.byArea.filter(a => a.delivered > 0).map(
        (area) =>
          `- ${area.name}: ${area.delivered} delivered (${area.freeDeliveries} Free, ${area.paidDeliveries} Paid)\n  Food: ₱${area.foodRevenue} | Fees: ₱${area.fees} | Total: ₱${area.totalRevenue}`
      ),
      "",
      "--- CANCELLATION SUMMARY ---",
      ...(report.cancellationSummary.length > 0 
        ? report.cancellationSummary.map(c => `- ${c.reason}: ${c.count} (${c.percentage}%)`)
        : ["No cancellations recorded for this period."])
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `delivery-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <div className="p-10 text-center text-muted">Loading reports...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          badge="Reports"
          title="Delivery Reports"
          subtitle="Monitor delivery performance, revenue, service areas, and order activity."
        />
        
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="rounded-xl border border-accent/20 bg-white px-4 py-2.5 text-sm font-medium text-[#800000] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Date Range</option>
            </select>
            
            {dateRange === "custom" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <input 
                        type="date" 
                        value={customStart} 
                        onChange={e => setCustomStart(e.target.value)}
                        className="w-full sm:w-auto rounded-lg border border-accent/20 px-3 py-1.5 text-sm text-[#800000] focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-muted hidden sm:inline">to</span>
                    <input 
                        type="date" 
                        value={customEnd} 
                        onChange={e => setCustomEnd(e.target.value)}
                        className="w-full sm:w-auto rounded-lg border border-accent/20 px-3 py-1.5 text-sm text-[#800000] focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
            )}
        </div>
      </div>

      {/* SUMMARY CARDS - ROW 1 */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Delivery Orders", value: report.totalOrders },
          { label: "Delivered Orders", value: report.delivered },
          { label: "Cancelled Orders", value: report.cancelled },
          { label: "Delivery Revenue", value: `₱${report.totalRevenue.toLocaleString()}` },
        ].map((stat) => (
          <div key={stat.label} className="admin-stat-card rounded-2xl p-5 pl-6 bg-white shadow-sm border border-accent/10">
            <p className="text-sm font-medium text-muted">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* SUMMARY CARDS - ROW 2 (Performance) */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Successful Delivery Rate", value: `${report.successRate}%` },
          { label: "Average Delivery Time", value: report.avgTime },
          { label: "Free Deliveries", value: report.freeDeliveriesCount },
          { label: "Paid Deliveries", value: report.paidDeliveriesCount },
        ].map((stat) => (
          <div key={stat.label} className="admin-stat-card rounded-2xl p-5 pl-6 bg-accent-light/10 border border-accent/10">
            <p className="text-sm font-medium text-[#800000]/80">{stat.label}</p>
            <p className="mt-3 font-serif text-2xl font-semibold text-accent">
              {stat.value}
            </p>
          </div>
        ))}
      </section>
      
      <div className="flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-accent to-accent-dark px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 shadow-md"
        >
          Export Delivery Report
        </button>
      </div>

      {/* CHARTS & DETAILS ROW */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Delivery Orders Over Time" subtitle="Compare orders and revenue">
          <div className="h-[300px] w-full p-4 min-w-0 overflow-x-auto">
            {report.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={report.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                            labelStyle={{ fontWeight: 'bold', color: '#800000', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                        <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#800000" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₱)" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: '#D4AF37' }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                    No data available for this period.
                </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel title="Orders by Status" subtitle="Current status distribution">
          <div className="space-y-4 px-6 py-5">
            {report.byStatus.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize text-[#800000]">
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <span className="font-medium text-accent">
                    {item.count} orders — {item.percentage}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent/10">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                        item.status === 'delivered' ? 'bg-green-500' : 
                        item.status === 'cancelled' ? 'bg-red-400' : 
                        'bg-accent'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Revenue by Service Area" subtitle="Delivered orders breakdown">
          <div className="space-y-3 px-6 py-5">
            {report.byArea.length > 0 ? report.byArea.filter(a => a.delivered > 0).map((area) => (
              <div
                key={area.areaId}
                className="rounded-xl border border-accent/10 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                      <span className="font-bold text-[#800000] text-lg">{area.name}</span>
                      <p className="text-xs font-medium text-muted mt-0.5">
                          {area.delivered} delivered ({area.freeDeliveries} Free, {area.paidDeliveries} Paid)
                      </p>
                  </div>
                  <div className="text-right">
                      <span className="text-lg font-bold text-accent">
                        ₱{area.totalRevenue.toLocaleString()}
                      </span>
                      <p className="text-[11px] text-muted font-medium mt-0.5">
                          Total Revenue
                      </p>
                  </div>
                </div>
                
                <div className="mt-3 flex gap-2 text-xs">
                    <div className="flex-1 bg-accent-light/20 rounded-md px-3 py-2">
                        <span className="text-muted block mb-0.5">Food Revenue</span>
                        <span className="font-semibold text-[#800000]">₱{area.foodRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex-1 bg-accent-light/20 rounded-md px-3 py-2">
                        <span className="text-muted block mb-0.5">Delivery Fees</span>
                        <span className="font-semibold text-[#800000]">₱{area.fees.toLocaleString()}</span>
                    </div>
                </div>
              </div>
            )) : (
                <div className="text-center text-sm text-muted py-6">No delivery data available for this period.</div>
            )}
          </div>
        </AdminPanel>

        <div className="space-y-5">
            <AdminPanel title="Delivery Performance" subtitle="Time metrics based on actual orders">
                <div className="grid grid-cols-2 gap-3 px-6 py-5">
                    <div className="rounded-xl border border-accent/10 bg-white p-4 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted uppercase tracking-wider">Fastest</p>
                        <p className="mt-1 font-serif text-2xl font-semibold text-green-600">{report.fastestTime}</p>
                    </div>
                    <div className="rounded-xl border border-accent/10 bg-white p-4 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted uppercase tracking-wider">Longest</p>
                        <p className="mt-1 font-serif text-2xl font-semibold text-red-500">{report.longestTime}</p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-accent/10 bg-accent p-4 text-center text-white shadow-sm flex flex-col justify-center items-center">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Average Delivery Time</p>
                        <p className="mt-1 font-serif text-2xl sm:text-3xl font-bold">{report.avgTime}</p>
                    </div>
                </div>
            </AdminPanel>
            
            <AdminPanel title="Cancellation Summary" subtitle="Reasons for order cancellations">
                <div className="px-6 py-5 space-y-3">
                    {report.cancellationSummary.length > 0 ? (
                        report.cancellationSummary.map(c => (
                            <div key={c.reason} className="flex items-center justify-between border-b border-accent/10 pb-2 last:border-0 last:pb-0">
                                <span className="text-sm font-medium text-[#800000]">{c.reason}</span>
                                <span className="text-sm font-bold text-accent">{c.count} ({c.percentage}%)</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted py-4">No cancellations recorded for this period.</div>
                    )}
                </div>
            </AdminPanel>
        </div>
      </div>
      
      <AdminPanel title="Top Delivery Areas" subtitle="Ranked by completed deliveries">
          <div className="px-6 py-5">
              {report.byArea.filter(a => a.delivered > 0).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {report.byArea.filter(a => a.delivered > 0).map((area, index) => (
                          <div key={area.areaId} className="flex items-center gap-3 rounded-xl border border-accent/10 bg-white p-3 shadow-sm">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                                  {index + 1}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                  <p className="truncate text-sm font-bold text-[#800000]">{area.name}</p>
                                  <p className="text-xs text-muted">{area.delivered} deliveries</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-semibold text-accent">₱{area.totalRevenue.toLocaleString()}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center text-sm text-muted py-4">No top delivery areas for this period.</div>
              )}
          </div>
      </AdminPanel>
    </div>
  );
}
