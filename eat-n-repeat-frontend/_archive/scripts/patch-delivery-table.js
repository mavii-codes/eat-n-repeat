const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/admin/DeliveryOrdersTable.tsx';
const content = `"use client";

import type { DeliveryOrder, DeliveryStatus } from "@/lib/admin/types";
import {
  deliveryStatusLabels,
  deliveryStatusStyles,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import { AdminSelect } from "@/components/admin/AdminForm";
import { Clock, CheckCircle2, AlertTriangle, User, MapPin, Search, Edit } from "lucide-react";

type DeliveryOrdersTableProps = {
  orders: DeliveryOrder[];
  getServiceAreaName: (id: string) => string;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  onDeliveryPersonChange?: (orderId: string, person: "Delivery Rider" | "Café Owner") => void;
  showStatusControl?: boolean;
  onArchive?: (order: DeliveryOrder) => void;
  onChat?: (order: DeliveryOrder) => void;
};

export function DeliveryOrdersTable({
  orders,
  getServiceAreaName,
  onStatusChange,
  onDeliveryPersonChange,
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

  const getPersonStatus = (person?: string) => {
    if (person === "Delivery Rider") return { label: "Rider Available", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (person === "Café Owner") return { label: "Owner Delivery", color: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "Delivery Person Unavailable", color: "text-red-700 bg-red-50 border-red-200" };
  };

  return (
    <>
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[1000px] text-left text-sm table-fixed">
          <thead>
            <tr className="admin-table-head text-muted border-b border-[#5A1824]/10">
              <th className="rounded-l-lg px-4 py-3 font-medium w-[10%]">Order</th>
              <th className="px-4 py-3 font-medium w-[18%]">Customer</th>
              <th className="px-4 py-3 font-medium w-[20%]">Items & Location</th>
              <th className="px-4 py-3 font-medium w-[10%]">Total</th>
              <th className="px-4 py-3 font-medium w-[15%]">Status</th>
              <th className="px-4 py-3 font-medium w-[17%]">Delivery Assignment</th>
              {onArchive && (
                <th className="rounded-r-lg px-4 py-3 font-medium text-right w-[10%]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const personStatus = getPersonStatus(order.deliveryPerson);
              
              return (
                <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50 transition-colors">
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-accent">{order.orderNumber}</p>
                    <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                      {formatDeliveryDate(order.orderedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-[#800000] truncate">{order.customerName}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted">{order.phone}</p>
                    {onChat && (
                      <button
                        type="button"
                        onClick={() => onChat(order)}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors border border-accent/10"
                      >
                        Chat with Customer
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-stone-700">{getServiceAreaName(order.serviceAreaId)}</p>
                        <p className="text-xs text-muted truncate">{order.address}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-stone-600 font-medium">
                      <p className="line-clamp-2">{order.items}</p>
                      {order.notes && order.notes.trim().length > 0 && (
                        <p className="mt-1 text-amber-700 italic border-l-2 border-amber-300 pl-2">Note: {order.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-[#800000]">
                      ₱{order.total.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-1">
                      Fee: ₱{order.deliveryFee.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {showStatusControl && onStatusChange ? (
                      <AdminSelect
                        value={order.status}
                        onChange={(e) => onStatusChange(order.id, e.target.value as DeliveryStatus)}
                        className={\`text-xs font-bold font-sans w-full py-1.5 \${deliveryStatusStyles[order.status] || ""}\`}
                      >
                        {Object.entries(deliveryStatusLabels).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </AdminSelect>
                    ) : (
                      <span className={\`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider \${deliveryStatusStyles[order.status] || "bg-gray-100 text-gray-800"}\`}>
                        {deliveryStatusLabels[order.status] || order.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {onDeliveryPersonChange && showStatusControl ? (
                      <AdminSelect
                        value={order.deliveryPerson || ""}
                        onChange={(e) => onDeliveryPersonChange(order.id, e.target.value as "Delivery Rider" | "Café Owner")}
                        className="text-xs font-bold w-full py-1.5 border-stone-200 bg-white"
                      >
                        <option value="Delivery Rider">Delivery Rider</option>
                        <option value="Café Owner">Café Owner</option>
                      </AdminSelect>
                    ) : (
                      <p className="font-bold text-stone-700 text-sm">
                        {order.deliveryPerson || "Unassigned"}
                      </p>
                    )}
                    <span className={\`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider \${personStatus.color}\`}>
                       {personStatus.label}
                    </span>
                  </td>
                  {onArchive && (
                    <td className="px-4 py-4 align-top text-right">
                      <button
                        type="button"
                        onClick={() => onArchive(order)}
                        className="text-[11px] font-bold text-muted hover:text-[#5A1824] underline transition-colors"
                      >
                        Archive
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden divide-y divide-[#5A1824]/10 bg-white/40 backdrop-blur-md">
        {orders.map((order) => {
           const personStatus = getPersonStatus(order.deliveryPerson);
           return (
            <div key={order.id} className="p-4 hover:bg-white/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-[#5A1824] text-lg">{order.orderNumber}</h3>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{formatDeliveryDate(order.orderedAt)}</p>
                </div>
                {!showStatusControl && (
                  <span className={\`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider \${deliveryStatusStyles[order.status] || "bg-gray-100 text-gray-800"}\`}>
                    {deliveryStatusLabels[order.status] || order.status}
                  </span>
                )}
              </div>
              
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-3 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-stone-700">{order.customerName}</p>
                  <p className="font-bold text-[#800000]">₱{order.total.toLocaleString()}</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-700">{getServiceAreaName(order.serviceAreaId)}</p>
                    <p className="text-[10px] text-muted line-clamp-1">{order.address}</p>
                  </div>
                </div>
                {onChat && (
                  <button
                    type="button"
                    onClick={() => onChat(order)}
                    className="w-full mt-2 inline-flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors border border-accent/10"
                  >
                    Chat with Customer
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {showStatusControl && onStatusChange && (
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Status</p>
                    <AdminSelect
                      value={order.status}
                      onChange={(e) => onStatusChange(order.id, e.target.value as DeliveryStatus)}
                      className={\`text-xs font-bold font-sans w-full py-2 \${deliveryStatusStyles[order.status] || ""}\`}
                    >
                      {Object.entries(deliveryStatusLabels).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                )}
                
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Assignment</p>
                  {onDeliveryPersonChange && showStatusControl ? (
                    <AdminSelect
                      value={order.deliveryPerson || ""}
                      onChange={(e) => onDeliveryPersonChange(order.id, e.target.value as "Delivery Rider" | "Café Owner")}
                      className="text-xs font-bold w-full py-2 border-stone-200 bg-white"
                    >
                      <option value="Delivery Rider">Delivery Rider</option>
                      <option value="Café Owner">Café Owner</option>
                    </AdminSelect>
                  ) : (
                    <p className="font-bold text-stone-700 text-sm">
                      {order.deliveryPerson || "Unassigned"}
                    </p>
                  )}
                  <span className={\`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider \${personStatus.color}\`}>
                     {personStatus.label}
                  </span>
                </div>
              </div>

              {onArchive && (
                <button
                  type="button"
                  onClick={() => onArchive(order)}
                  className="mt-4 w-full text-center text-xs font-bold text-muted hover:text-[#5A1824] underline transition-colors"
                >
                  Archive Order
                </button>
              )}
            </div>
           )
        })}
      </div>
    </>
  );
}
`;
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully wrote DeliveryOrdersTable.tsx');
