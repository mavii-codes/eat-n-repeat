"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { StaffPanel, staffThead, staffTh, staffTd, staffRow, staffEmptyCell } from "@/components/staff/StaffPanel";
import { Coffee, RotateCcw, Package, ShoppingBag, Truck, Archive } from "lucide-react";

export function ArchiveTab() {
  const {
    menuItems,
    menuCategories,
    storeOrders,
    deliveryOrders,
    restoreMenuItem,
    restoreStoreOrder,
    restoreDeliveryOrder,
  } = useAdminData();

  const [activeFilter, setActiveFilter] = useState<"all" | "menu" | "store_orders" | "delivery_orders">("all");

  const archivedMenuItems = useMemo(() => menuItems.filter((m) => m.archived), [menuItems]);
  const archivedStoreOrders = useMemo(() => storeOrders.filter((o) => o.archived), [storeOrders]);
  const archivedDeliveryOrders = useMemo(() => deliveryOrders.filter((d) => d.archived), [deliveryOrders]);

  const totalArchivedCount = archivedMenuItems.length + archivedStoreOrders.length + archivedDeliveryOrders.length;

  const getCategoryName = (id: string) => {
    return menuCategories.find((c) => c.id === id)?.name || "Unknown";
  };

  const handleRestoreMenu = (id: string) => {
    if (confirm("Restore this menu item to the active menu?")) {
      restoreMenuItem(id);
    }
  };

  const handleRestoreStoreOrder = (id: string) => {
    if (confirm("Restore this store order to active orders?")) {
      restoreStoreOrder(id);
    }
  };

  const handleRestoreDeliveryOrder = (id: string) => {
    if (confirm("Restore this delivery order to active deliveries?")) {
      restoreDeliveryOrder(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">
            Archive
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">
            Archived Items &amp; Orders
          </h1>
          <p className="text-sm text-muted mt-1">
            View and restore previously archived menu items and order records.
          </p>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: `All (${totalArchivedCount})` },
          { id: "menu", label: `Menu Items (${archivedMenuItems.length})` },
          { id: "store_orders", label: `Store Orders (${archivedStoreOrders.length})` },
          { id: "delivery_orders", label: `Delivery Orders (${archivedDeliveryOrders.length})` },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id as any)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all border ${
              activeFilter === filter.id
                ? "bg-[#800000] text-white border-[#800000] shadow-sm"
                : "bg-white/80 text-stone-600 border-stone-200 hover:border-[#800000]/30"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ARCHIVED MENU ITEMS */}
      {(activeFilter === "all" || activeFilter === "menu") && (
        <StaffPanel icon={<Coffee className="h-5 w-5 text-[#800000]" />} title="Archived Menu Items" subtitle={`${archivedMenuItems.length} item(s) hidden from the active menu`}>
          <div className="overflow-x-auto p-2">
            {archivedMenuItems.length === 0 ? (
              <p className={staffEmptyCell}>No archived menu items.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={staffThead}>
                    <th className={staffTh}>Item</th>
                    <th className={staffTh}>Category</th>
                    <th className={staffTh}>Price</th>
                    <th className={`${staffTh} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {archivedMenuItems.map((item) => (
                    <tr key={item.id} className={staffRow}>
                      <td className={staffTd}>
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover grayscale border border-stone-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400">
                              <Coffee className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-ink">{item.name}</p>
                            <p className="text-xs text-muted truncate max-w-[200px]">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className={staffTd}><span className="text-xs text-muted">{getCategoryName(item.categoryId)}</span></td>
                      <td className={staffTd}><span className="font-bold text-[#800000]">₱{item.price}</span></td>
                      <td className={`${staffTd} text-right`}>
                        <button
                          onClick={() => handleRestoreMenu(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </StaffPanel>
      )}

      {/* ARCHIVED STORE ORDERS */}
      {(activeFilter === "all" || activeFilter === "store_orders") && (
        <StaffPanel icon={<ShoppingBag className="h-5 w-5 text-[#800000]" />} title="Archived In-Store Orders" subtitle={`${archivedStoreOrders.length} order record(s)`}>
          <div className="overflow-x-auto p-2">
            {archivedStoreOrders.length === 0 ? (
              <p className={staffEmptyCell}>No archived in-store orders.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={staffThead}>
                    <th className={staffTh}>Order ID</th>
                    <th className={staffTh}>Items</th>
                    <th className={staffTh}>Total</th>
                    <th className={staffTh}>Status</th>
                    <th className={`${staffTh} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {archivedStoreOrders.map((order) => (
                    <tr key={order.id} className={staffRow}>
                      <td className={`${staffTd} font-bold text-[#800000]`}>{order.orderId}</td>
                      <td className={`${staffTd} text-xs text-muted max-w-[200px] truncate`}>{order.items}</td>
                      <td className={`${staffTd} font-bold text-[#24753c]`}>₱{order.total}</td>
                      <td className={staffTd}><span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold capitalize text-stone-600 border border-stone-200">{order.status}</span></td>
                      <td className={`${staffTd} text-right`}>
                        <button
                          onClick={() => handleRestoreStoreOrder(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </StaffPanel>
      )}

      {/* ARCHIVED DELIVERY ORDERS */}
      {(activeFilter === "all" || activeFilter === "delivery_orders") && (
        <StaffPanel icon={<Truck className="h-5 w-5 text-[#800000]" />} title="Archived Delivery Orders" subtitle={`${archivedDeliveryOrders.length} order record(s)`}>
          <div className="overflow-x-auto p-2">
            {archivedDeliveryOrders.length === 0 ? (
              <p className={staffEmptyCell}>No archived delivery orders.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={staffThead}>
                    <th className={staffTh}>Order Number</th>
                    <th className={staffTh}>Customer</th>
                    <th className={staffTh}>Total</th>
                    <th className={staffTh}>Status</th>
                    <th className={`${staffTh} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {archivedDeliveryOrders.map((order) => (
                    <tr key={order.id} className={staffRow}>
                      <td className={`${staffTd} font-bold text-[#800000]`}>{order.orderNumber}</td>
                      <td className={`${staffTd} text-xs font-medium text-ink`}>{order.customerName}</td>
                      <td className={`${staffTd} font-bold text-[#24753c]`}>₱{order.total}</td>
                      <td className={staffTd}><span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold capitalize text-stone-600 border border-stone-200">{order.status}</span></td>
                      <td className={`${staffTd} text-right`}>
                        <button
                          onClick={() => handleRestoreDeliveryOrder(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </StaffPanel>
      )}
    </div>
  );
}
