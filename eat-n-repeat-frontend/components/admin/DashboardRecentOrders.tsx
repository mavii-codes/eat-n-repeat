"use client";

import { useAdminData } from "@/context/AdminDataContext";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";

export function DashboardRecentOrders() {
  const { getActiveStoreOrders, archiveStoreOrder } = useAdminData();
  const orders = getActiveStoreOrders();

  return (
    <RecentOrdersTable
      orders={orders}
      onArchive={(order) => {
        if (confirm(`Archive order ${order.orderId}?`)) {
          archiveStoreOrder(order.id);
        }
      }}
    />
  );
}
