"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { AdminPanel } from "@/components/admin/AdminForm";
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
        <AdminPanel
          title="Archived Menu Items"
          subtitle={`${archivedMenuItems.length} item(s) hidden from the active menu`}
        >
          <div className="overflow-x-auto p-2">
            {archivedMenuItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No archived menu items.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-accent/10 text-muted">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedMenuItems.map((item) => (
                    <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50">
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-xs text-muted">{getCategoryName(item.categoryId)}</td>
                      <td className="px-4 py-3 font-bold text-[#800000]">₱{item.price}</td>
                      <td className="px-4 py-3 text-right">
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
        </AdminPanel>
      )}

      {/* ARCHIVED STORE ORDERS */}
      {(activeFilter === "all" || activeFilter === "store_orders") && (
        <AdminPanel
          title="Archived In-Store Orders"
          subtitle={`${archivedStoreOrders.length} order record(s)`}
        >
          <div className="overflow-x-auto p-2">
            {archivedStoreOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No archived in-store orders.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-accent/10 text-muted">
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedStoreOrders.map((order) => (
                    <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50">
                      <td className="px-4 py-3 font-bold text-[#800000]">{order.orderId}</td>
                      <td className="px-4 py-3 text-xs text-muted max-w-[200px] truncate">{order.items}</td>
                      <td className="px-4 py-3 font-bold text-[#24753c]">₱{order.total}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold capitalize text-stone-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
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
        </AdminPanel>
      )}

      {/* ARCHIVED DELIVERY ORDERS */}
      {(activeFilter === "all" || activeFilter === "delivery_orders") && (
        <AdminPanel
          title="Archived Delivery Orders"
          subtitle={`${archivedDeliveryOrders.length} order record(s)`}
        >
          <div className="overflow-x-auto p-2">
            {archivedDeliveryOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No archived delivery orders.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-accent/10 text-muted">
                    <th className="px-4 py-3 font-medium">Order Number</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedDeliveryOrders.map((order) => (
                    <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-white/50">
                      <td className="px-4 py-3 font-bold text-[#800000]">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-xs font-medium text-ink">{order.customerName}</td>
                      <td className="px-4 py-3 font-bold text-[#24753c]">₱{order.total}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold capitalize text-stone-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
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
        </AdminPanel>
      )}
    </div>
  );
}
