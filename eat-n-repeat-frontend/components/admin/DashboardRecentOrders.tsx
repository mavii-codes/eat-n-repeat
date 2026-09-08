"use client";

import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useAdminData } from "@/context/AdminDataContext";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";

export function DashboardRecentOrders() {
  const { confirm } = useConfirm();
  const { getActiveStoreOrders, archiveStoreOrder } = useAdminData();
  const orders = getActiveStoreOrders();

  return (
    <RecentOrdersTable
      orders={orders}
      onArchive={async (order) => {
        const confirmed = await confirm({
          title: "Confirm Action",
          message: `Archive order ${order.orderId}?`,
          variant: "danger",
          confirmLabel: "Archive",
        });
        if (!confirmed) return;
        archiveStoreOrder(order.id);
      }}
    />
  );
}
