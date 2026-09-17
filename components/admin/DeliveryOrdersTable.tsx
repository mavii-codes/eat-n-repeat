"use client";

import { useState, useMemo } from "react";
import type {
  DeliveryOrder,
  DeliveryStatus,
  AvailabilityStatus,
  DeliveryTeamMember,
} from "@/lib/admin/types";
import {
  deliveryStatusLabels,
  deliveryStatusStyles,
  availabilityStatusStyles,
  getRoleBadgeInfo,
  getSuggestedDeliveryPerson,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import { useAdminData } from "@/context/AdminDataContext";
import {
  Search,
  MapPin,
  MessageSquare,
  Eye,
  Clock,
  X,
  Truck,
  History,
  Users,
  Bike,
  UserCheck,
} from "lucide-react";

type DeliveryOrdersTableProps = {
  orders: DeliveryOrder[];
  getServiceAreaName?: (id: string) => string;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  onDeliveryPersonChange?: (orderId: string, person: "Delivery Rider" | "Café Owner") => void;
  showStatusControl?: boolean;
  onChat?: (order: DeliveryOrder) => void;
  onArchive?: (order: DeliveryOrder) => void;
  isAdmin?: boolean;
};

export function DeliveryOrdersTable({
  orders,
  onStatusChange,
  onChat,
  isAdmin = true,
}: DeliveryOrdersTableProps) {
  const {
    deliveryTeam = [],
    updateDeliveryTeamMemberStatus,
    reassignDeliveryOrder,
  } = useAdminData();

  // Search & History Filters State
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // Reassign Modal State
  const [reassigningOrder, setReassigningOrder] = useState<DeliveryOrder | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [reassignNote, setReassignNote] = useState<string>("");

  // View Order Modal & Tab State
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"details" | "history">("details");

  // Ensure team only contains Rider & Owner
  const twoPersonTeam = useMemo(() => {
    const rider = deliveryTeam.find((t) => t.personType === "RIDER" || t.role === "Delivery Rider") || {
      id: "dtm-rider",
      name: "Delivery Rider",
      role: "Delivery Rider" as const,
      personType: "RIDER" as const,
      status: "Available" as const,
      activeDeliveriesCount: 0,
    };

    const owner = deliveryTeam.find((t) => t.personType === "OWNER" || t.role === "Café Owner") || {
      id: "dtm-owner",
      name: "Café Owner",
      role: "Café Owner" as const,
      personType: "OWNER" as const,
      status: "Available" as const,
      activeDeliveriesCount: 0,
    };

    return [rider, owner];
  }, [deliveryTeam]);

  // Suggested Courier calculation
  const suggestedCourier = useMemo(() => {
    return getSuggestedDeliveryPerson(twoPersonTeam);
  }, [twoPersonTeam]);

  // Active Deliveries (Pending, Preparing, Ready, Assigned, Out for Delivery)
  const activeOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        !order.archived &&
        ["pending", "preparing", "ready_for_delivery", "assigned", "out_for_delivery"].includes(
          order.status
        )
    );
  }, [orders]);

  // History Deliveries (Delivered, Cancelled)
  const historyOrders = useMemo(() => {
    return orders.filter(
      (order) => order.archived || ["delivered", "cancelled"].includes(order.status)
    );
  }, [orders]);

  // Filter Query Helper
  const filterByQuery = (list: DeliveryOrder[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        (o.deliveryPersonName && o.deliveryPersonName.toLowerCase().includes(q)) ||
        (o.deliveryPerson && o.deliveryPerson.toLowerCase().includes(q))
    );
  };

  const searchedActiveOrders = useMemo(
    () => filterByQuery(activeOrders),
    [activeOrders, search]
  );

  const searchedHistoryOrders = useMemo(() => {
    let list = filterByQuery(historyOrders);
    if (historyFilter === "delivered") {
      list = list.filter((o) => o.status === "delivered");
    } else if (historyFilter === "cancelled") {
      list = list.filter((o) => o.status === "cancelled");
    } else if (historyFilter === "rider") {
      list = list.filter(
        (o) =>
          o.deliveryPersonType === "RIDER" ||
          o.deliveryPersonRole === "Delivery Rider" ||
          o.deliveryPerson === "Delivery Rider"
      );
    } else if (historyFilter === "owner") {
      list = list.filter(
        (o) =>
          o.deliveryPersonType === "OWNER" ||
          o.deliveryPersonRole === "Café Owner" ||
          o.deliveryPerson === "Café Owner"
      );
    }
    return list;
  }, [historyOrders, search, historyFilter]);

  // Open Reassign Modal
  function handleOpenReassignModal(order: DeliveryOrder) {
    setReassigningOrder(order);
    const available = twoPersonTeam.find((t) => t.status === "Available");
    setSelectedMemberId(order.deliveryPersonId || (available ? available.id : twoPersonTeam[0]?.id || ""));
    setReassignNote("");
  }

  // Execute Reassignment
  function handleConfirmReassign() {
    if (!reassigningOrder || !selectedMemberId) return;
    reassignDeliveryOrder(reassigningOrder.id, selectedMemberId, reassignNote.trim() || undefined);
    setReassigningOrder(null);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. DELIVERY AVAILABILITY PANEL (STRICTLY 2 PERSONNEL) ── */}
      <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-6 shadow-sm backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#63131d]/10 text-[#63131d] border border-[#63131d]/20">
                <Users className="w-3 h-3" /> Delivery Availability
              </span>
              <span className="text-xs font-semibold text-stone-500">
                Current Assigned Courier: <strong className="text-stone-900 font-bold">{suggestedCourier.name}</strong>
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#63131d] mt-1">
              Delivery Personnel Status
            </h2>
          </div>
        </div>

        {/* 2 PERSONNEL STATUS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {twoPersonTeam.map((member) => {
            const isRider = member.personType === "RIDER";
            const roleBadge = getRoleBadgeInfo(member.role);
            const activeCount = member.activeDeliveriesCount || 0;

            return (
              <div
                key={member.id}
                className="bg-stone-50/80 p-5 rounded-2xl border border-stone-200/70 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRider ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {isRider ? <Bike className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-900 text-base">{member.name}</h3>
                        <p className="text-xs text-stone-500 font-semibold">{isRider ? "Designated Delivery Rider" : "Manager / Owner"}</p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        availabilityStatusStyles[member.status] || "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${roleBadge.badgeClass}`}>
                      {roleBadge.label}
                    </span>
                    <span className="font-semibold text-stone-600">
                      {activeCount} active {activeCount === 1 ? "delivery" : "deliveries"}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Switch */}
                {isAdmin && (
                  <div className="pt-3 border-t border-stone-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Toggle Availability
                    </span>
                    <button
                      onClick={() =>
                        updateDeliveryTeamMemberStatus(member.id, member.status === "Available" ? "Unavailable" : "Available")
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        member.status === "Available"
                          ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      Set as {member.status === "Available" ? "Unavailable" : "Available"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. SEARCH BAR ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <input
          type="text"
          placeholder="Search by Order ID, Customer name, Phone, Address, or Delivery Person..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-white/95 py-3.5 pl-11 pr-4 text-sm text-stone-800 placeholder-stone-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#63131d]/20 focus:border-[#63131d]/30 transition-all"
        />
      </div>

      {/* ── 3. ACTIVE DELIVERIES QUEUE PANEL ── */}
      <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-[#63131d]">
              Active Deliveries Queue
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Live delivery orders pending dispatch, out for delivery, or requiring status updates.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#63131d]/10 text-[#63131d] border border-[#63131d]/20 w-fit">
            <Truck className="w-3.5 h-3.5" /> {searchedActiveOrders.length} Active Orders
          </span>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-[11px] font-bold tracking-wider text-stone-400 uppercase py-3">
                <th className="pb-4 font-bold">ORDER ID & DATE</th>
                <th className="pb-4 font-bold">CUSTOMER & ADDRESS</th>
                <th className="pb-4 font-bold">MANIFEST & TOTAL</th>
                <th className="pb-4 font-bold">DELIVERY PERSON</th>
                <th className="pb-4 font-bold">STATUS & ETA</th>
                <th className="pb-4 font-bold text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {searchedActiveOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Truck className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-sm">No active delivery orders found</p>
                  </td>
                </tr>
              ) : (
                searchedActiveOrders.map((order) => {
                  const isOwner =
                    order.deliveryPersonType === "OWNER" ||
                    order.deliveryPerson === "Café Owner" ||
                    order.deliveryPersonRole === "Café Owner";
                  const personName = isOwner ? "Café Owner" : "Delivery Rider";
                  const badgeInfo = getRoleBadgeInfo(personName);

                  return (
                    <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                      {/* ORDER ID & DATE */}
                      <td className="py-4 pr-4 align-top">
                        <p className="font-bold text-[#63131d] text-base">{order.orderNumber}</p>
                        <p className="text-[10px] text-stone-400 font-semibold mt-1">
                          {formatDeliveryDate(order.orderedAt)}
                        </p>
                      </td>

                      {/* CUSTOMER & ADDRESS */}
                      <td className="py-4 pr-4 align-top max-w-[220px]">
                        <p className="font-bold text-stone-900 text-sm">{order.customerName}</p>
                        <p className="text-xs font-semibold text-stone-500 mt-0.5">{order.phone}</p>
                        <div className="flex items-start gap-1 mt-1.5 text-stone-500">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-stone-400" />
                          <p className="text-[11px] leading-snug line-clamp-2">{order.address}</p>
                        </div>
                      </td>

                      {/* MANIFEST & TOTAL */}
                      <td className="py-4 pr-4 align-top">
                        <p className="text-xs font-semibold text-stone-700 max-w-[200px] truncate">
                          {order.items}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="font-black text-stone-900 text-sm">
                            ₱{order.total}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Paid
                          </span>
                        </div>
                      </td>

                      {/* DELIVERY PERSON */}
                      <td className="py-4 pr-4 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-stone-900 text-xs">{personName}</p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeInfo.badgeClass}`}>
                              {badgeInfo.label}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenReassignModal(order)}
                                className="text-[10px] font-bold text-[#63131d] hover:underline cursor-pointer"
                              >
                                [ Reassign ]
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* STATUS & ETA */}
                      <td className="py-4 pr-4 align-top">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              deliveryStatusStyles[order.status] ||
                              "bg-stone-100 text-stone-700 border-stone-200"
                            }`}
                          >
                            {deliveryStatusLabels[order.status] || order.status}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-stone-500 font-semibold">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>ETA: {order.estimatedDeliveryTime || "15–25 min"}</span>
                          </div>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 text-right align-top">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* UPDATE STATUS DROPDOWN */}
                          {onStatusChange && (
                            <select
                              value={order.status}
                              onChange={(e) =>
                                onStatusChange(order.id, e.target.value as DeliveryStatus)
                              }
                              className="text-xs font-bold py-1.5 px-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 shadow-2xs outline-none focus:ring-2 focus:ring-[#63131d]/20 cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="ready_for_delivery">Ready for Delivery</option>
                              <option value="assigned">Assigned</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          )}

                          {/* VIEW ORDER */}
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setActiveDetailTab("details");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-400" /> View
                          </button>

                          {/* CHAT WITH CUSTOMER */}
                          {onChat && (
                            <button
                              onClick={() => onChat(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#63131d]/20 bg-[#63131d]/5 text-[#63131d] font-bold text-xs hover:bg-[#63131d]/10 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Chat
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE STACKED CARDS VIEW */}
        <div className="md:hidden space-y-4">
          {searchedActiveOrders.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Truck className="h-8 w-8 mx-auto mb-2 text-stone-300" />
              <p className="font-semibold text-sm">No active delivery orders found</p>
            </div>
          ) : (
            searchedActiveOrders.map((order) => {
              const isOwner =
                order.deliveryPersonType === "OWNER" ||
                order.deliveryPerson === "Café Owner" ||
                order.deliveryPersonRole === "Café Owner";
              const personName = isOwner ? "Café Owner" : "Delivery Rider";
              const badgeInfo = getRoleBadgeInfo(personName);

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-[#63131d] text-base">{order.orderNumber}</p>
                      <p className="text-[10px] text-stone-400 font-semibold">
                        {formatDeliveryDate(order.orderedAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        deliveryStatusStyles[order.status] || "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {deliveryStatusLabels[order.status] || order.status}
                    </span>
                  </div>

                  {/* Customer & Address */}
                  <div className="space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <p className="font-bold text-stone-900 text-xs">{order.customerName}</p>
                    <p className="text-[11px] text-stone-500 font-semibold">{order.phone}</p>
                    <div className="flex items-start gap-1 text-stone-600 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                      <p className="text-xs leading-snug">{order.address}</p>
                    </div>
                  </div>

                  {/* Items & Total */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-600 truncate max-w-[180px]">
                      {order.items}
                    </span>
                    <span className="font-black text-stone-900 text-sm">₱{order.total}</span>
                  </div>

                  {/* Courier & Role Badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Delivery Person</p>
                      <p className="font-bold text-stone-900">{personName}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeInfo.badgeClass}`}>
                      {badgeInfo.label}
                    </span>
                  </div>

                  {/* Mobile Actions */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {onStatusChange && (
                      <select
                        value={order.status}
                        onChange={(e) => onStatusChange(order.id, e.target.value as DeliveryStatus)}
                        className="flex-1 text-xs font-bold py-2 px-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 shadow-2xs outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready_for_delivery">Ready for Delivery</option>
                        <option value="assigned">Assigned</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}

                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setActiveDetailTab("details");
                      }}
                      className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs"
                    >
                      View
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleOpenReassignModal(order)}
                        className="px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 font-bold text-xs"
                      >
                        Reassign
                      </button>
                    )}

                    {onChat && (
                      <button
                        onClick={() => onChat(order)}
                        className="px-3 py-2 rounded-xl border border-[#63131d]/20 bg-[#63131d]/5 text-[#63131d] font-bold text-xs"
                      >
                        Chat
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          , "pending")}
        </div>
      </div>

      {/* ── 4. DELIVERY HISTORY PANEL ── */}
      <div className="rounded-3xl border border-stone-200/80 bg-white/95 p-6 sm:p-8 shadow-sm backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <h2 className="font-serif text-xl font-bold tracking-tight text-[#63131d]">
              Delivery History
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Archive of completed and cancelled delivery orders.
            </p>
          </div>

          {/* FILTER PILLS */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All History" },
              { id: "delivered", label: "Delivered" },
              { id: "cancelled", label: "Cancelled" },
              { id: "rider", label: "Rider Delivery" },
              { id: "owner", label: "Owner Delivery" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setHistoryFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === f.id
                    ? "bg-[#63131d] text-white shadow-2xs"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-[11px] font-bold tracking-wider text-stone-400 uppercase py-3">
                <th className="pb-3 font-bold">ORDER ID</th>
                <th className="pb-3 font-bold">CUSTOMER</th>
                <th className="pb-3 font-bold">ADDRESS</th>
                <th className="pb-3 font-bold">DELIVERY PERSON</th>
                <th className="pb-3 font-bold">TOTAL</th>
                <th className="pb-3 font-bold">DATE</th>
                <th className="pb-3 font-bold text-right">FINAL STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {searchedHistoryOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400 text-xs">
                    No delivery history orders found.
                  </td>
                </tr>
              ) : (
                searchedHistoryOrders.map((order) => {
                  const isOwner =
                    order.deliveryPersonType === "OWNER" ||
                    order.deliveryPerson === "Café Owner" ||
                    order.deliveryPersonRole === "Café Owner";
                  const personName = isOwner ? "Café Owner" : "Delivery Rider";
                  const badgeInfo = getRoleBadgeInfo(personName);

                  return (
                    <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 font-bold text-[#63131d] text-xs">{order.orderNumber}</td>
                      <td className="py-3 font-bold text-stone-800 text-xs">{order.customerName}</td>
                      <td className="py-3 text-xs text-stone-500 max-w-[200px] truncate">
                        {order.address}
                      </td>
                      <td className="py-3 text-xs">
                        <p className="font-bold text-stone-900">{personName}</p>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border mt-0.5 ${badgeInfo.badgeClass}`}>
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td className="py-3 font-black text-stone-900 text-xs">₱{order.total}</td>
                      <td className="py-3 text-[11px] text-stone-400 font-semibold">
                        {formatDeliveryDate(order.orderedAt)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            deliveryStatusStyles[order.status] || "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {deliveryStatusLabels[order.status] || order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. MANUAL REASSIGNMENT MODAL (EXACTLY 2 OPTIONS) ── */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#63131d]">
                  Assign Delivery
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
                  Order {reassigningOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setReassigningOrder(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-stone-600 font-medium">
                Select who will handle the delivery for <strong>{reassigningOrder.customerName}</strong> ({reassigningOrder.address}):
              </p>

              <div className="space-y-2">
                {twoPersonTeam.map((member) => {
                  const isSelected = selectedMemberId === member.id;
                  const isAvailable = member.status === "Available";
                  const isRider = member.personType === "RIDER";

                  return (
                    <label
                      key={member.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        !isAvailable
                          ? "opacity-60 border-stone-200 bg-stone-50 cursor-pointer"
                          : isSelected
                          ? "border-[#63131d] bg-[#63131d]/5 ring-1 ring-[#63131d]/20 cursor-pointer"
                          : "border-stone-200/80 bg-white hover:border-stone-300 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="reassign-member"
                          checked={isSelected}
                          onChange={() => setSelectedMemberId(member.id)}
                          className="h-4 w-4 text-[#63131d] focus:ring-[#63131d]"
                        />
                        <div>
                          <p className="font-bold text-stone-900 text-sm">{member.name}</p>
                          <p className="text-xs text-stone-500 font-medium">
                            {isRider ? "Designated Delivery Rider" : "Manager / Owner"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            availabilityStatusStyles[member.status]
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Optional Reassignment Note */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Optional Reassignment Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rider unavailable, Owner taking delivery..."
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 px-3 text-xs text-stone-800 outline-none focus:ring-2 focus:ring-[#63131d]/20"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReassigningOrder(null)}
                className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={!selectedMemberId}
                className="py-2.5 px-5 rounded-xl bg-[#63131d] text-white text-xs font-bold hover:bg-[#500f17] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. VIEW ORDER DETAILS & ASSIGNMENT HISTORY MODAL ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Delivery Order Summary
                </span>
                <h3 className="font-serif text-xl font-bold text-[#63131d]">
                  {selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR: DETAILS vs ASSIGNMENT HISTORY */}
            <div className="flex border-b border-stone-200 gap-4">
              <button
                onClick={() => setActiveDetailTab("details")}
                className={`pb-2 text-xs font-bold transition-all cursor-pointer ${
                  activeDetailTab === "details"
                    ? "border-b-2 border-[#63131d] text-[#63131d]"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Order Details
              </button>
              <button
                onClick={() => setActiveDetailTab("history")}
                className={`pb-2 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeDetailTab === "history"
                    ? "border-b-2 border-[#63131d] text-[#63131d]"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <History className="w-3.5 h-3.5" /> Assignment History ({selectedOrder.assignmentHistory?.length || 1})
              </button>
            </div>

            {activeDetailTab === "details" ? (
              <div className="space-y-3 text-xs animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-100">
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[9px]">Customer</p>
                    <p className="font-bold text-stone-900 text-sm mt-0.5">{selectedOrder.customerName}</p>
                    <p className="text-stone-500 font-medium">{selectedOrder.phone}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[9px]">Assigned Courier</p>
                    <p className="font-bold text-stone-900 text-sm mt-0.5">
                      {selectedOrder.deliveryPersonName || selectedOrder.deliveryPerson || "Delivery Rider"}
                    </p>
                    <p className="text-stone-500 font-semibold text-[10px]">
                      {selectedOrder.deliveryPersonType === "OWNER" || selectedOrder.deliveryPerson === "Café Owner" ? "Manager / Owner" : "Designated Delivery Rider"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-stone-400 font-bold uppercase text-[9px] mb-1">Delivery Address</p>
                  <div className="flex items-start gap-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-100 text-stone-700 font-medium">
                    <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <div>
                      <p>{selectedOrder.address}</p>
                      {selectedOrder.deliveryDistanceKm !== undefined && (
                        <p className="text-[10px] text-stone-500 mt-1">
                          Distance: <span className="font-bold text-stone-600">{selectedOrder.deliveryDistanceKm} km</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-stone-400 font-bold uppercase text-[9px] mb-1">Delivery Fee</p>
                  <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-100 font-semibold text-stone-800">
                    <span className="text-xs text-stone-500 font-medium">
                      {selectedOrder.deliveryFeeRule || 'Flat rate / Legacy'}
                    </span>
                    {selectedOrder.deliveryFee === 0 ? (
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">FREE</span>
                    ) : (
                      <span className="font-bold">₱{selectedOrder.deliveryFee?.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-stone-400 font-bold uppercase text-[9px] mb-1">Ordered Items Manifest</p>
                  <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100 font-semibold text-stone-800">
                    {selectedOrder.items}
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <p className="text-amber-600 font-bold uppercase text-[9px] mb-1 flex items-center gap-1">
                       Customer Note / Instructions
                    </p>
                    <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 font-semibold text-amber-900 italic">
                      {selectedOrder.notes}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-stone-400 font-bold uppercase text-[9px] mb-1">Timeline</p>
                  <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100 font-semibold text-stone-800 grid grid-cols-2 gap-y-2 text-[10px]">
                    <div className="text-stone-500">Pending</div>
                    <div className="text-right">{selectedOrder.pendingAt ? new Date(selectedOrder.pendingAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                    
                    <div className="text-stone-500">Confirmed</div>
                    <div className="text-right">{selectedOrder.confirmedAt ? new Date(selectedOrder.confirmedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                    
                    <div className="text-stone-500">Preparing</div>
                    <div className="text-right">{selectedOrder.preparingAt ? new Date(selectedOrder.preparingAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                    
                    <div className="text-stone-500">Ready for Delivery</div>
                    <div className="text-right">{selectedOrder.readyForDeliveryAt ? new Date(selectedOrder.readyForDeliveryAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                    
                    <div className="text-stone-500">Out for Delivery</div>
                    <div className="text-right">{selectedOrder.outForDeliveryAt ? new Date(selectedOrder.outForDeliveryAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                    
                    <div className="text-stone-500 font-bold text-[#63131d]">Delivered</div>
                    <div className="text-right font-bold text-[#63131d]">{selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-100 text-sm">
                  <span className="font-bold text-stone-600">Total Price Paid</span>
                  <span className="font-black text-stone-900 text-base">₱{selectedOrder.total}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-1 max-h-60 overflow-y-auto animate-in fade-in duration-150">
                {!selectedOrder.assignmentHistory || selectedOrder.assignmentHistory.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-6">No reassignment records.</p>
                ) : (
                  selectedOrder.assignmentHistory.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-900">{h.personName}</span>
                          <span className="text-[10px] text-stone-500 font-semibold">({h.personRole})</span>
                        </div>
                        <p className="text-[10px] font-bold text-[#63131d] mt-0.5">{h.action}</p>
                        {h.note && (
                          <p className="text-[10px] text-stone-600 italic mt-0.5">Note: &ldquo;{h.note}&rdquo;</p>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono font-semibold shrink-0">
                        {h.timestamp}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-[#63131d] text-white font-bold text-xs hover:bg-[#500f17] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
