const fs = require('fs');

const content = `"use client";

import { useState, useRef, useEffect } from "react";
import type { DeliveryOrder, DeliveryStatus } from "@/lib/admin/types";
import {
  deliveryStatusLabels,
  deliveryStatusStyles,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import { AdminSelect } from "@/components/admin/AdminForm";
import { Clock, CheckCircle2, AlertTriangle, User, Bike, MapPin, Search, Edit, MoreVertical, Eye, MessageSquare, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";

type DeliveryOrdersTableProps = {
  orders: DeliveryOrder[];
  getServiceAreaName: (id: string) => string;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  onDeliveryPersonChange?: (orderId: string, person: "Delivery Rider" | "Café Owner") => void;
  showStatusControl?: boolean;
  onArchive?: (order: DeliveryOrder) => void;
  onChat?: (order: DeliveryOrder) => void;
};

function OrderRow({
  order,
  getServiceAreaName,
  showStatusControl,
  onStatusChange,
  onDeliveryPersonChange,
  onChat,
  onArchive
}: {
  order: DeliveryOrder;
  getServiceAreaName: (id: string) => string;
  showStatusControl: boolean;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  onDeliveryPersonChange?: (orderId: string, person: "Delivery Rider" | "Café Owner") => void;
  onChat?: (order: DeliveryOrder) => void;
  onArchive?: (order: DeliveryOrder) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const person = order.deliveryPerson;
  const isRider = person === "Delivery Rider";
  const isOwner = person === "Café Owner";
  const personColor = isRider ? "text-emerald-700 bg-emerald-50 border-emerald-200" : isOwner ? "text-amber-700 bg-amber-50 border-amber-200" : "text-stone-500 bg-stone-100 border-stone-200";
  const personLabel = isRider ? "Weekend" : isOwner ? "Weekday" : "Unassigned";

  return (
    <>
      {/* DESKTOP ROW */}
      <tr className="hidden md:table-row border-b border-accent/5 last:border-0 hover:bg-white/50 transition-colors">
        <td className="px-4 py-4 align-top w-[12%]">
          <p className="font-bold text-accent">{order.orderNumber}</p>
          <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-wider">
            {formatDeliveryDate(order.orderedAt)}
          </p>
        </td>
        
        <td className="px-4 py-4 align-top w-[18%]">
          <p className="font-bold text-[#800000] truncate">{order.customerName}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">{order.phone}</p>
          <div className="flex items-start gap-1 mt-1.5">
            <MapPin className="w-3 h-3 text-muted shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted line-clamp-2">{order.address}</p>
          </div>
        </td>
        
        <td className="px-4 py-4 align-top w-[15%]">
          {isEditingPerson && onDeliveryPersonChange && showStatusControl ? (
            <AdminSelect
              value={order.deliveryPerson || ""}
              onChange={(e) => {
                onDeliveryPersonChange(order.id, e.target.value as "Delivery Rider" | "Café Owner");
                setIsEditingPerson(false);
              }}
              className="text-xs font-bold w-full py-1.5 border-stone-200 bg-white shadow-sm"
              onBlur={() => setIsEditingPerson(false)}
              autoFocus
            >
              <option value="Delivery Rider">Delivery Rider</option>
              <option value="Café Owner">Café Owner</option>
            </AdminSelect>
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                {isRider ? <Bike className="w-4 h-4 text-emerald-700" /> : isOwner ? <User className="w-4 h-4 text-amber-700" /> : null}
                <p className="font-bold text-stone-700 text-sm">
                  {person || "Unassigned"}
                </p>
              </div>
              <span className={\`inline-block mt-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider \${personColor}\`}>
                {personLabel}
              </span>
            </div>
          )}
        </td>
        
        <td className="px-4 py-4 align-top w-[20%]">
          <p className="text-xs font-bold text-stone-700">{getServiceAreaName(order.serviceAreaId)}</p>
          <div className="mt-1 text-xs text-stone-600 font-medium">
            <p className="line-clamp-2">{order.items}</p>
          </div>
        </td>
        
        <td className="px-4 py-4 align-top w-[10%]">
          <p className="font-bold text-[#800000]">
            ₱{order.total.toLocaleString()}
          </p>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-1">
            Fee: ₱{order.deliveryFee.toLocaleString()}
          </p>
        </td>
        
        <td className="px-4 py-4 align-top w-[15%]">
          {isEditingStatus && onStatusChange && showStatusControl ? (
            <AdminSelect
              value={order.status}
              onChange={(e) => {
                onStatusChange(order.id, e.target.value as DeliveryStatus);
                setIsEditingStatus(false);
              }}
              className={\`text-xs font-bold font-sans w-full py-1.5 shadow-sm \${deliveryStatusStyles[order.status] || ""}\`}
              onBlur={() => setIsEditingStatus(false)}
              autoFocus
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
        
        <td className="px-4 py-4 align-top w-[10%] text-right relative">
          <div ref={menuRef} className="inline-block text-left">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-1.5 text-muted hover:text-accent bg-transparent hover:bg-accent/5 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                <button className="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" /> View Order
                </button>
                <button className="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> View Customer
                </button>
                {onChat && (
                  <button onClick={() => { onChat(order); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat with Customer
                  </button>
                )}
                {showStatusControl && onDeliveryPersonChange && (
                  <button onClick={() => { setIsEditingPerson(true); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 border-t border-stone-100">
                    <Truck className="w-3.5 h-3.5" /> Change Delivery Person
                  </button>
                )}
                {showStatusControl && onStatusChange && (
                  <button onClick={() => { setIsEditingStatus(true); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" /> Update Delivery Status
                  </button>
                )}
                {onArchive && (
                  <button onClick={() => { onArchive(order); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100">
                    Archive Order
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      
      {/* MOBILE ROW */}
      <div className="md:hidden p-4 border-b border-[#5A1824]/10 hover:bg-white/50 transition-colors">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-black text-[#5A1824] text-lg">{order.orderNumber}</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{formatDeliveryDate(order.orderedAt)}</p>
          </div>
          <span className={\`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider \${deliveryStatusStyles[order.status] || "bg-gray-100 text-gray-800"}\`}>
            {deliveryStatusLabels[order.status] || order.status}
          </span>
        </div>
        
        <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-3 space-y-2">
          <div className="flex justify-between items-center">
            <p className="font-bold text-stone-700">{order.customerName}</p>
            <p className="font-bold text-[#800000]">₱{order.total.toLocaleString()}</p>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-muted line-clamp-1">{order.address}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3 border-t border-stone-100 pt-3">
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Delivery Person</p>
            <div className="flex items-center gap-1.5">
              {isRider ? <Bike className="w-3.5 h-3.5 text-emerald-700" /> : isOwner ? <User className="w-3.5 h-3.5 text-amber-700" /> : null}
              <p className="font-bold text-stone-700 text-sm">
                {person || "Unassigned"}
              </p>
            </div>
            <span className={\`inline-block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider \${personColor}\`}>
              {personLabel}
            </span>
          </div>
          <div>
             <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Actions</p>
             <div className="flex flex-wrap gap-1">
               {onChat && (
                 <button onClick={() => onChat(order)} className="px-2 py-1 bg-accent/5 text-accent border border-accent/10 rounded text-[10px] font-bold">Chat</button>
               )}
               {showStatusControl && onDeliveryPersonChange && (
                 <button onClick={() => setIsEditingPerson(true)} className="px-2 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded text-[10px] font-bold">Reassign</button>
               )}
               {showStatusControl && onStatusChange && (
                 <button onClick={() => setIsEditingStatus(true)} className="px-2 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded text-[10px] font-bold">Status</button>
               )}
             </div>
          </div>
        </div>

        {/* Mobile Inline Editors */}
        {isEditingPerson && onDeliveryPersonChange && showStatusControl && (
          <div className="mb-3 p-3 bg-white border border-stone-200 rounded-xl">
             <p className="text-xs font-bold text-muted mb-2">Change Delivery Person:</p>
             <AdminSelect
              value={order.deliveryPerson || ""}
              onChange={(e) => {
                onDeliveryPersonChange(order.id, e.target.value as "Delivery Rider" | "Café Owner");
                setIsEditingPerson(false);
              }}
              className="text-xs font-bold w-full py-2 shadow-sm border-stone-300"
            >
              <option value="Delivery Rider">Delivery Rider</option>
              <option value="Café Owner">Café Owner</option>
            </AdminSelect>
          </div>
        )}

        {isEditingStatus && onStatusChange && showStatusControl && (
           <div className="mb-3 p-3 bg-white border border-stone-200 rounded-xl">
             <p className="text-xs font-bold text-muted mb-2">Change Status:</p>
             <AdminSelect
              value={order.status}
              onChange={(e) => {
                onStatusChange(order.id, e.target.value as DeliveryStatus);
                setIsEditingStatus(false);
              }}
              className="text-xs font-bold w-full py-2 shadow-sm border-stone-300"
            >
              {Object.entries(deliveryStatusLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </AdminSelect>
          </div>
        )}
      </div>
    </>
  );
}

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

  return (
    <>
      <div className="hidden md:block overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[1000px] text-left text-sm table-fixed">
          <thead>
            <tr className="admin-table-head text-muted border-b border-[#5A1824]/10">
              <th className="rounded-l-lg px-4 py-3 font-medium w-[12%]">Order</th>
              <th className="px-4 py-3 font-medium w-[18%]">Customer Details</th>
              <th className="px-4 py-3 font-medium w-[15%]">Delivery Person</th>
              <th className="px-4 py-3 font-medium w-[20%]">Manifest</th>
              <th className="px-4 py-3 font-medium w-[10%]">Total</th>
              <th className="px-4 py-3 font-medium w-[15%]">Status</th>
              <th className="rounded-r-lg px-4 py-3 font-medium text-right w-[10%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                getServiceAreaName={getServiceAreaName}
                showStatusControl={showStatusControl}
                onStatusChange={onStatusChange}
                onDeliveryPersonChange={onDeliveryPersonChange}
                onChat={onChat}
                onArchive={onArchive}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[#5A1824]/10 bg-white/40 backdrop-blur-md">
         {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              getServiceAreaName={getServiceAreaName}
              showStatusControl={showStatusControl}
              onStatusChange={onStatusChange}
              onDeliveryPersonChange={onDeliveryPersonChange}
              onChat={onChat}
              onArchive={onArchive}
            />
          ))}
      </div>
    </>
  );
}
`;

fs.writeFileSync('c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/admin/DeliveryOrdersTable.tsx', content, 'utf8');
console.log('Wrote DeliveryOrdersTable.tsx');
