"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DeliveryOrdersTable } from "@/components/admin/DeliveryOrdersTable";
import { AdminChatModal } from "@/components/admin/AdminChatModal";
import { useAdminData } from "@/context/AdminDataContext";
import { Truck, CheckCircle2, Clock } from "lucide-react";

export default function DeliveryPage() {
  const {
    deliveryOrders,
    updateDeliveryStatus,
    getServiceAreaName,
    getActiveDeliveryOrders,
    getDeliveryHistory,
    updateDeliveryPerson,
  } = useAdminData();

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<{ customerName: string; orderNumber: string } | null>(null);

  const handleOpenChat = (customerName: string, orderNumber: string) => {
    setActiveChatOrder({ customerName, orderNumber });
    setChatOpen(true);
  };

  const activeOrders = getActiveDeliveryOrders();
  const historyOrders = getDeliveryHistory();
  const outForDeliveryCount = deliveryOrders.filter((order) => order.status === "out_for_delivery").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Delivery"
        title="Delivery Orders"
        subtitle="Manage live delivery dispatches, monitor courier schedule, and view delivery logs."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/delivery/settings"
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
            >
              Fees & Areas
            </Link>
            <Link
              href="/admin/delivery/reports"
              className="rounded-xl bg-[#63131d] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#500f17] transition-colors shadow-2xs"
            >
              Delivery Reports
            </Link>
          </div>
        }
      />

      {/* KPI SUMMARY STAT CARDS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#63131d]/10 flex items-center justify-center text-[#63131d] shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Active Deliveries</p>
            <p className="text-2xl font-black text-[#63131d] mt-0.5">{activeOrders.length}</p>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-rose-200 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Out for Delivery</p>
            <p className="text-2xl font-black text-rose-700 mt-0.5">{outForDeliveryCount}</p>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-emerald-200 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Completed Orders</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">{historyOrders.length}</p>
          </div>
        </div>
      </section>

      {/* MAIN DELIVERY ORDERS TABLE COMPONENT */}
      <DeliveryOrdersTable
        orders={deliveryOrders}
        getServiceAreaName={getServiceAreaName}
        showStatusControl={true}
        onStatusChange={updateDeliveryStatus}
        onDeliveryPersonChange={updateDeliveryPerson}
        onChat={(order) => handleOpenChat(order.customerName, order.orderNumber)}
        isAdmin={true}
      />

      {activeChatOrder && (
        <AdminChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          customerName={activeChatOrder.customerName}
          orderId={activeChatOrder.orderNumber}
        />
      )}
    </div>
  );
}
