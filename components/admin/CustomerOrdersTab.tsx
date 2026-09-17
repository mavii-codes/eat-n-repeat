"use client";

import { useState, useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { AdminPanel } from "@/components/admin/AdminForm";
import { 
  ShoppingBag, 
  Utensils, 
  Bike, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Check, 
  X,
  ChevronRight
} from "lucide-react";

export function CustomerOrdersTab() {
  const { 
    storeOrders, 
    deliveryOrders, 
    updateStoreOrderStatus, 
    confirmStoreOrderPayment,
    updateDeliveryStatus 
  } = useAdminData();

  const [filterType, setFilterType] = useState<"all" | "dine-in" | "takeout" | "delivery">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Unify the orders
  const allOrders = useMemo(() => {
    const combined = [
      ...storeOrders.map(o => ({
         id: o.id,
         orderId: o.orderId,
         time: o.time,
         items: o.items,
         total: o.total,
         status: o.status,
         paid: !!o.paid,
         archived: o.archived,
         unifiedType: (o.orderType || "takeout") as "dine-in" | "takeout" | "delivery",
         customerName: o.customerName || "Walk-in Customer",
         tableNumber: o.tableNumber,
         notes: o.notes,
         isDelivery: false,
         originalOrder: o
      })),
      ...deliveryOrders.map(d => ({
         id: d.id,
         orderId: d.orderNumber,
         time: new Date(d.orderedAt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
         items: d.items,
         total: d.total,
         status: d.status,
         paid: true, // assume paid for simplified delivery unless noted
         archived: d.archived,
         unifiedType: "delivery" as "dine-in" | "takeout" | "delivery",
         customerName: d.customerName,
         tableNumber: undefined,
         notes: d.notes,
         isDelivery: true,
         originalOrder: d
      }))
    ];
    return combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [storeOrders, deliveryOrders]);

  const activeOrders = allOrders.filter(o => !o.archived && o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered");
  const historyOrders = allOrders.filter(o => o.status === "completed" || o.status === "cancelled" || o.status === "delivered");

  const filteredActive = activeOrders.filter(o => {
    if (filterType !== "all" && o.unifiedType !== filterType) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!o.orderId.toLowerCase().includes(term) && !o.customerName.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const selectedOrderDetails = allOrders.find(o => o.id === selectedOrderId);

  // Status Summary Counts
  const counts = {
    new: activeOrders.filter(o => o.status === "pending").length,
    confirmed: activeOrders.filter(o => o.status === "confirmed").length,
    preparing: activeOrders.filter(o => o.status === "preparing").length,
    ready: activeOrders.filter(o => o.status === "ready" || o.status === "out_for_delivery").length,
    completed: historyOrders.filter(o => o.status === "completed" || o.status === "delivered").length,
  };

  const handleStatusUpdate = (order: typeof activeOrders[0], newStatus: any) => {
    if (order.isDelivery) {
       updateDeliveryStatus(order.id, newStatus);
    } else {
       updateStoreOrderStatus(order.id, newStatus);
    }
    setSelectedOrderId(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "dine-in": return <Utensils className="w-3.5 h-3.5" />;
      case "takeout": return <ShoppingBag className="w-3.5 h-3.5" />;
      case "delivery": return <Bike className="w-3.5 h-3.5" />;
      default: return <ShoppingBag className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-800";
      case "confirmed": return "bg-blue-100 text-blue-800";
      case "preparing": return "bg-orange-100 text-orange-800";
      case "ready": 
      case "out_for_delivery": return "bg-purple-100 text-purple-800";
      case "completed": 
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-stone-100 text-stone-600";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-[#fce7db] px-2.5 py-0.5 text-xs font-semibold capitalize text-[#5A1824] border border-[#5A1824]/10">Operations</span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#5A1824] mt-1.5">Customer Orders</h1>
          <p className="text-sm text-[#817875] mt-1">Manage customer orders, payments, and fulfillment.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#817875]" />
              <input 
                type="text" 
                placeholder="Search orders or customers..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white/80 border border-[#5A1824]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A1824]/30 w-full sm:w-64"
              />
           </div>
        </div>
      </div>

      {/* STATUS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "New", count: counts.new, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Confirmed", count: counts.confirmed, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Preparing", count: counts.preparing, color: "text-orange-700", bg: "bg-orange-50" },
          { label: "Ready", count: counts.ready, color: "text-purple-700", bg: "bg-purple-50" },
          { label: "Completed", count: counts.completed, color: "text-green-700", bg: "bg-green-50" },
        ].map(stat => (
          <div key={stat.label} className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md ${stat.bg}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${stat.color} opacity-80`}>{stat.label}</span>
            <span className={`text-2xl font-black ${stat.color}`}>{stat.count}</span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_350px] gap-6 items-start">
        <div className="space-y-6">
          
          {/* INCOMING ORDERS (Top Priority) */}
          {counts.new > 0 && (
            <AdminPanel title="INCOMING ORDERS" subtitle={`${counts.new} NEW`}>
              <div className="divide-y divide-[#5A1824]/10 bg-white/60 backdrop-blur-md">
                {activeOrders.filter(o => o.status === "pending").map(order => (
                  <div key={order.id} className="p-4 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-bold text-[#5A1824] mr-2">{order.orderId}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-widest">NEW</span>
                        <h3 className="font-semibold text-lg text-[#2B2523] mt-1">{order.customerName}</h3>
                        <p className="text-xs font-medium text-[#817875] flex items-center gap-1 mt-0.5">
                          {getTypeIcon(order.unifiedType)}
                          <span className="capitalize">{order.unifiedType}</span>
                          {order.tableNumber && ` · Table ${order.tableNumber}`}
                        </p>
                      </div>
                      <div className="text-right">
                         <p className="font-black text-lg text-[#5A1824]">₱{order.total}</p>
                         <p className="text-[10px] font-bold uppercase text-[#817875]">{order.paid ? "Paid" : "Pending Payment"}</p>
                      </div>
                    </div>
                    <div className="text-sm text-[#2B2523] mb-4 p-3 bg-white/80 rounded-xl border border-amber-100/50">
                      {order.items}
                    </div>
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => handleStatusUpdate(order, "confirmed")}
                         className="px-4 py-2 bg-[#5A1824] text-white text-sm font-bold rounded-xl shadow-md hover:bg-[#802233] transition-all"
                       >
                         Accept Order
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>
          )}

          {/* ACTIVE ORDERS */}
          <AdminPanel title="ACTIVE ORDERS" subtitle="Managing ongoing fulfillment">
            {/* Filters Row */}
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[#5A1824]/10 bg-white/40 backdrop-blur-md">
               <div className="flex gap-1 bg-white/80 p-1 rounded-lg border border-[#5A1824]/10 shadow-sm">
                 {["all", "dine-in", "takeout", "delivery"].map(t => (
                   <button 
                     key={t}
                     onClick={() => setFilterType(t as any)}
                     className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${filterType === t ? "bg-[#5A1824] text-white" : "text-[#817875] hover:bg-stone-100"}`}
                   >
                     {t}
                   </button>
                 ))}
               </div>
               <div className="flex gap-1 bg-white/80 p-1 rounded-lg border border-[#5A1824]/10 shadow-sm">
                 {["all", "confirmed", "preparing", "ready"].map(s => (
                   <button 
                     key={s}
                     onClick={() => setFilterStatus(s)}
                     className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${filterStatus === s ? "bg-stone-200 text-[#2B2523]" : "text-[#817875] hover:bg-stone-100"}`}
                   >
                     {s}
                   </button>
                 ))}
               </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto bg-white/60 backdrop-blur-md">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-stone-50/50 text-[#817875] text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-3 font-bold">Order</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold">Items</th>
                    <th className="px-4 py-3 font-bold">Total</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#5A1824]/5">
                  {filteredActive.filter(o => o.status !== "pending").length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-[#817875]">No active orders match your filters.</td></tr>
                  ) : (
                    filteredActive.filter(o => o.status !== "pending").map(order => (
                      <tr key={order.id} className="hover:bg-white/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-[#5A1824]">{order.orderId}</td>
                        <td className="px-4 py-3 font-semibold text-[#2B2523]">{order.customerName}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs text-[#817875] capitalize font-medium">
                            {getTypeIcon(order.unifiedType)}
                            {order.unifiedType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#817875] truncate max-w-[150px]">{order.items}</td>
                        <td className="px-4 py-3 font-bold text-[#2B2523]">₱{order.total}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getStatusColor(order.status)}`}>
                            {order.status === 'out_for_delivery' ? 'Delivering' : order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => setSelectedOrderId(order.id)}
                            className="text-xs font-bold text-[#5A1824] hover:underline flex items-center justify-end gap-1 ml-auto"
                          >
                            View Order <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>

          {/* ORDER HISTORY */}
          <AdminPanel title="ORDER HISTORY" subtitle="Completed and cancelled orders">
            <div className="overflow-x-auto bg-white/60 backdrop-blur-md">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead>
                  <tr className="text-[#817875] text-[11px] uppercase tracking-wider border-b border-[#5A1824]/10 bg-stone-50/50">
                    <th className="px-4 py-3 font-bold">Order</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Time</th>
                    <th className="px-4 py-3 font-bold">Total</th>
                    <th className="px-4 py-3 font-bold">Final Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.slice(0, 10).map((order) => (
                    <tr key={order.id} className="border-b border-[#5A1824]/5 hover:bg-white/40 opacity-80">
                      <td className="px-4 py-3 font-bold text-[#5A1824]">{order.orderId}</td>
                      <td className="px-4 py-3 text-sm text-[#2B2523]">{order.customerName}</td>
                      <td className="px-4 py-3 text-xs text-[#817875]">{order.time}</td>
                      <td className="px-4 py-3 font-semibold text-[#2B2523]">₱{order.total}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          order.status === "completed" || order.status === "delivered" ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-700"
                        }`}>
                          {order.status === "delivered" ? "completed" : order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {historyOrders.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-[#817875]">No order history.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>

        {/* RIGHT PANEL - SELECTED ORDER DETAILS */}
        <div className="sticky top-6">
          {selectedOrderDetails ? (
            <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
               <button 
                 onClick={() => setSelectedOrderId(null)}
                 className="absolute top-4 right-4 p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
               
               <p className="text-[10px] font-black uppercase tracking-widest text-[#817875] mb-1">Order Details</p>
               <h2 className="font-serif text-2xl font-bold text-[#5A1824] mb-4">#{selectedOrderDetails.orderId}</h2>
               
               <div className="space-y-4 mb-6">
                 <div>
                   <p className="text-[10px] font-bold text-[#817875] uppercase">Customer</p>
                   <p className="font-semibold text-[#2B2523]">{selectedOrderDetails.customerName}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-[#817875] uppercase">Order Type</p>
                   <p className="font-semibold text-[#2B2523] capitalize flex items-center gap-1.5">
                     {getTypeIcon(selectedOrderDetails.unifiedType)}
                     {selectedOrderDetails.unifiedType}
                     {selectedOrderDetails.tableNumber && ` · Table ${selectedOrderDetails.tableNumber}`}
                   </p>
                 </div>
                 {selectedOrderDetails.isDelivery && 'address' in selectedOrderDetails.originalOrder && (
                   <div>
                     <p className="text-[10px] font-bold text-[#817875] uppercase">Delivery Address</p>
                     <p className="text-sm font-medium text-[#2B2523]">{selectedOrderDetails.originalOrder.address as string}</p>
                   </div>
                 )}
               </div>

               <div className="border-t border-b border-[#5A1824]/10 py-4 mb-6 space-y-2">
                 <p className="text-[10px] font-bold text-[#817875] uppercase mb-2">Items</p>
                 <div className="text-sm font-medium text-[#2B2523] whitespace-pre-line">
                   {selectedOrderDetails.items}
                 </div>
               </div>

               {selectedOrderDetails.notes && (
                 <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl mb-6">
                   <p className="text-[10px] font-bold text-amber-800 uppercase mb-2 flex items-center gap-1">
                     <AlertCircle className="w-3.5 h-3.5" /> Customer Note / Instructions
                   </p>
                   <p className="text-sm font-semibold text-amber-950 italic">{selectedOrderDetails.notes}</p>
                 </div>
               )}

               <div className="flex justify-between items-end mb-6">
                 <div>
                   <p className="text-[10px] font-bold text-[#817875] uppercase mb-1">Payment</p>
                   {selectedOrderDetails.paid ? (
                     <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">Confirmed Paid</span>
                   ) : (
                     <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">Pending</span>
                   )}
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-[#817875] uppercase">Total</p>
                   <p className="font-black text-2xl text-[#5A1824]">₱{selectedOrderDetails.total}</p>
                 </div>
               </div>

               <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/60 mb-6">
                 <p className="text-[10px] font-bold text-[#817875] uppercase mb-3">Order Status</p>
                 <div className="space-y-3">
                    {[
                      { s: "confirmed", l: "Order Confirmed" },
                      { s: "preparing", l: "Preparing" },
                      { s: "ready", l: selectedOrderDetails.isDelivery ? "Out for Delivery" : "Ready" },
                      { s: "completed", l: "Completed" },
                    ].map((step, i) => {
                       const statuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "delivered", "cancelled"];
                       const currentIndex = statuses.indexOf(
                         selectedOrderDetails.status === "out_for_delivery" ? "ready" : 
                         selectedOrderDetails.status === "delivered" ? "completed" : 
                         selectedOrderDetails.status
                       );
                       const stepIndex = statuses.indexOf(step.s);
                       const isPast = currentIndex >= stepIndex;
                       const isCurrent = currentIndex === stepIndex;
                       
                       return (
                         <div key={step.s} className="flex items-center gap-3">
                           <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${isPast ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400"}`}>
                             {isPast ? <Check className="w-3 h-3" /> : (i + 1)}
                           </div>
                           <span className={`text-xs font-bold ${isCurrent ? "text-[#5A1824]" : isPast ? "text-emerald-700" : "text-stone-400"}`}>{step.l}</span>
                         </div>
                       )
                    })}
                 </div>
               </div>

               {/* STAFF ACTION BUTTON */}
               <div>
                  {!selectedOrderDetails.paid && !selectedOrderDetails.isDelivery && (
                    <button 
                      onClick={() => confirmStoreOrderPayment(selectedOrderDetails.id)}
                      className="w-full mb-3 py-3 rounded-xl border-2 border-emerald-500 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-colors"
                    >
                      Confirm Payment Received
                    </button>
                  )}

                  {selectedOrderDetails.status === "pending" && (
                    <button onClick={() => handleStatusUpdate(selectedOrderDetails, "confirmed")} className="w-full py-3 bg-[#5A1824] hover:bg-[#802233] text-white font-bold text-sm rounded-xl transition-all shadow-md">
                      Accept Order
                    </button>
                  )}
                  {selectedOrderDetails.status === "confirmed" && (
                    <button onClick={() => handleStatusUpdate(selectedOrderDetails, "preparing")} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-all shadow-md">
                      Start Preparing
                    </button>
                  )}
                  {selectedOrderDetails.status === "preparing" && (
                    <button onClick={() => handleStatusUpdate(selectedOrderDetails, selectedOrderDetails.isDelivery ? "out_for_delivery" : "ready")} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md">
                      Mark as {selectedOrderDetails.isDelivery ? "Out for Delivery" : "Ready"}
                    </button>
                  )}
                  {(selectedOrderDetails.status === "ready" || selectedOrderDetails.status === "out_for_delivery") && (
                    <button onClick={() => handleStatusUpdate(selectedOrderDetails, selectedOrderDetails.isDelivery ? "delivered" : "completed")} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md">
                      Complete Order
                    </button>
                  )}
               </div>
            </div>
          ) : (
            <div className="bg-white/40 border border-white/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center h-[400px] backdrop-blur-md">
              <div className="w-16 h-16 bg-white/60 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#817875]/50" />
              </div>
              <p className="font-bold text-[#5A1824]">No Order Selected</p>
              <p className="text-xs text-[#817875] mt-2 max-w-[200px]">Select an order from the list to view details and manage fulfillment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
