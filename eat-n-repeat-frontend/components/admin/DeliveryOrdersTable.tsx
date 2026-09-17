"use client";

import type { DeliveryOrder, DeliveryStatus } from "@/lib/admin/types";
import {
  deliveryStatusLabels,
  deliveryStatusStyles,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import { AdminSelect } from "@/components/admin/AdminForm";

type DeliveryOrdersTableProps = {
  orders: DeliveryOrder[];
  getServiceAreaName: (id: string) => string;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  showStatusControl?: boolean;
  onArchive?: (order: DeliveryOrder) => void;
  onChat?: (order: DeliveryOrder) => void;
};

export function DeliveryOrdersTable({
  orders,
  getServiceAreaName,
  onStatusChange,
  showStatusControl = false,
  onArchive,
  onChat,
}: DeliveryOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="font-medium text-[#800000]">No delivery orders found</p>
        <p className="mt-1 text-sm text-muted">
          Orders will appear here when customers place deliveries.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-2 pb-2">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="admin-table-head text-muted">
            <th className="rounded-l-lg px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Area</th>
            <th className="px-4 py-3 font-medium">Items</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className={`px-4 py-3 font-medium ${onArchive ? "" : "rounded-r-lg"}`}>
              Ordered
            </th>
            {onArchive && (
              <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-accent/5 last:border-0">
              <td className="px-4 py-3 font-semibold text-accent">
                {order.orderNumber}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-[#800000]">{order.customerName}</p>
                <p className="mt-0.5 text-xs text-muted">{order.phone}</p>
                <p className="mt-0.5 text-xs text-muted">{order.address}</p>
                {onChat && (
                  <button
                    type="button"
                    onClick={() => onChat(order)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer focus:outline-none"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Chat with Customer
                  </button>
                )}
              </td>
              <td className="px-4 py-3 text-muted">
                {getServiceAreaName(order.serviceAreaId)}
              </td>
              <td className="px-4 py-3 text-muted">{order.items}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-[#800000]">
                  ₱{order.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted">
                  Fee: ₱{order.deliveryFee.toLocaleString()}
                </p>
              </td>
              <td className="px-4 py-3">
                {showStatusControl && onStatusChange ? (
                  <AdminSelect
                    value={order.status}
                    onChange={(e) =>
                      onStatusChange(
                        order.id,
                        e.target.value as DeliveryStatus,
                      )
                    }
                    className="min-w-[140px] py-1.5 text-xs"
                  >
                    {(Object.keys(deliveryStatusLabels) as DeliveryStatus[]).map(
                      (status) => (
                        <option key={status} value={status}>
                          {deliveryStatusLabels[status]}
                        </option>
                      ),
                    )}
                  </AdminSelect>
                ) : (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${deliveryStatusStyles[order.status]}`}
                  >
                    {deliveryStatusLabels[order.status]}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatDeliveryDate(order.orderedAt)}
                {order.deliveredAt && (
                  <p className="mt-1 text-xs text-success">
                    Delivered {formatDeliveryDate(order.deliveredAt)}
                  </p>
                )}
              </td>
              {onArchive && (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onArchive(order)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    Archive
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
