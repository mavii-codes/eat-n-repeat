"use client";

import { useMemo } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import {
  deliveryStatusLabels,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";

export default function DeliveryReportsPage() {
  const { deliveryOrders, serviceAreas, getServiceAreaName } = useAdminData();

  const report = useMemo(() => {
    const activeOrders = deliveryOrders.filter((order) => !order.archived);
    const delivered = activeOrders.filter((order) => order.status === "delivered");
    const cancelled = activeOrders.filter((order) => order.status === "cancelled");
    const totalRevenue = delivered.reduce((sum, order) => sum + order.total, 0);
    const totalFees = delivered.reduce(
      (sum, order) => sum + order.deliveryFee,
      0,
    );
    const avgOrderValue =
      delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;

    const byArea = serviceAreas.map((area) => {
      const areaOrders = activeOrders.filter(
        (order) => order.serviceAreaId === area.id,
      );
      const areaDelivered = areaOrders.filter(
        (order) => order.status === "delivered",
      );

      return {
        areaId: area.id,
        name: area.name,
        totalOrders: areaOrders.length,
        delivered: areaDelivered.length,
        revenue: areaDelivered.reduce((sum, order) => sum + order.total, 0),
        fees: areaDelivered.reduce((sum, order) => sum + order.deliveryFee, 0),
      };
    });

    const byStatus = Object.keys(deliveryStatusLabels).map((status) => ({
      status,
      count: activeOrders.filter((order) => order.status === status).length,
    }));

    return {
      totalOrders: activeOrders.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      active: activeOrders.length - delivered.length - cancelled.length,
      totalRevenue,
      totalFees,
      avgOrderValue,
      byArea,
      byStatus,
      recentDelivered: delivered.slice(0, 5),
    };
  }, [deliveryOrders, serviceAreas]);

  function handleExport() {
    const lines = [
      "Eat n' Repeat — Delivery Report",
      `Generated: ${new Date().toLocaleString("en-PH")}`,
      "",
      `Total Orders: ${report.totalOrders}`,
      `Delivered: ${report.delivered}`,
      `Cancelled: ${report.cancelled}`,
      `Active: ${report.active}`,
      `Total Revenue: ₱${report.totalRevenue}`,
      `Delivery Fees Collected: ₱${report.totalFees}`,
      `Average Order Value: ₱${report.avgOrderValue}`,
      "",
      "By Service Area:",
      ...report.byArea.map(
        (area) =>
          `- ${area.name}: ${area.totalOrders} orders, ₱${area.revenue} revenue, ₱${area.fees} fees`,
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `delivery-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AdminPageHeader
        badge="Reports"
        title="Delivery Reports"
        subtitle="Generate delivery performance summaries, revenue breakdowns, and area reports."
      />

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Orders", value: report.totalOrders },
          { label: "Delivered", value: report.delivered },
          { label: "Delivery Fees", value: `₱${report.totalFees.toLocaleString()}` },
          { label: "Avg Order Value", value: `₱${report.avgOrderValue.toLocaleString()}` },
        ].map((stat) => (
          <div key={stat.label} className="admin-stat-card rounded-2xl p-5 pl-6">
            <p className="text-sm font-medium text-muted">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Export Delivery Report
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Orders by Status" subtitle="Current delivery breakdown">
          <div className="space-y-3 px-6 py-5">
            {report.byStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent-light/30 px-4 py-3"
              >
                <span className="text-sm font-medium capitalize text-[#800000]">
                  {item.status.replaceAll("_", " ")}
                </span>
                <span className="font-semibold text-accent">{item.count}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Revenue by Service Area" subtitle="Delivered orders only">
          <div className="space-y-3 px-6 py-5">
            {report.byArea.map((area) => (
              <div
                key={area.areaId}
                className="rounded-xl border border-accent/10 bg-accent-light/30 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#800000]">{area.name}</span>
                  <span className="text-sm font-semibold text-accent">
                    ₱{area.revenue.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {area.delivered} delivered · ₱{area.fees.toLocaleString()} fees
                </p>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Recent Delivered Orders"
        subtitle="Latest completed deliveries"
      >
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {report.recentDelivered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No delivered orders yet.
                  </td>
                </tr>
              ) : (
                report.recentDelivered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-accent/5 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-accent">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {getServiceAreaName(order.serviceAreaId)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#800000]">
                      ₱{order.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {order.deliveredAt
                        ? formatDeliveryDate(order.deliveredAt)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </>
  );
}
