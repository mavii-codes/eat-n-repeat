"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel, RestoreButton } from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import {
  deliveryStatusLabels,
} from "@/lib/admin/delivery-utils";

type ArchiveTab = "menu" | "categories" | "staff" | "orders";

function formatArchivedAt(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ArchivesPage() {
  const {
    menuItems,
    menuCategories,
    staffAccounts,
    storeOrders,
    deliveryOrders,
    restoreMenuItem,
    restoreMenuCategory,
    restoreStaffAccount,
    restoreStoreOrder,
    restoreDeliveryOrder,
    getMenuCategoryName,
  } = useAdminData();

  const [tab, setTab] = useState<ArchiveTab>("menu");

  const archivedMenuItems = useMemo(
    () => menuItems.filter((item) => item.archived),
    [menuItems],
  );
  const archivedCategories = useMemo(
    () => menuCategories.filter((category) => category.archived),
    [menuCategories],
  );
  const archivedStaff = useMemo(
    () => staffAccounts.filter((account) => account.archived),
    [staffAccounts],
  );
  const archivedStoreOrders = useMemo(
    () => storeOrders.filter((order) => order.archived),
    [storeOrders],
  );
  const archivedDeliveryOrders = useMemo(
    () => deliveryOrders.filter((order) => order.archived),
    [deliveryOrders],
  );

  const tabs: { id: ArchiveTab; label: string; count: number }[] = [
    { id: "menu", label: "Menu Items", count: archivedMenuItems.length },
    { id: "categories", label: "Categories", count: archivedCategories.length },
    { id: "staff", label: "Staff Accounts", count: archivedStaff.length },
    {
      id: "orders",
      label: "Old Orders",
      count: archivedStoreOrders.length + archivedDeliveryOrders.length,
    },
  ];

  return (
    <>
      <AdminPageHeader
        badge="Archives"
        title="Archives"
        subtitle="View and restore archived menu items, categories, staff accounts, and old orders."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                : "border border-accent/10 bg-card text-muted hover:bg-accent-light hover:text-accent"
            }`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {tab === "menu" && (
        <AdminPanel title="Archived Menu Items" subtitle="Restore items back to the active menu">
          <ArchiveTable
            emptyMessage="No archived menu items."
            headers={["Name", "Category", "Price", "Archived", "Actions"]}
            rows={archivedMenuItems.map((item) => ({
              id: item.id,
              cells: [
                item.name,
                getMenuCategoryName(item.categoryId),
                `₱${item.price.toLocaleString()}`,
                formatArchivedAt(item.archivedAt),
              ],
              onRestore: () => restoreMenuItem(item.id),
            }))}
          />
        </AdminPanel>
      )}

      {tab === "categories" && (
        <AdminPanel title="Archived Categories" subtitle="Restore menu categories">
          <ArchiveTable
            emptyMessage="No archived categories."
            headers={["Name", "Description", "Archived", "Actions"]}
            rows={archivedCategories.map((category) => ({
              id: category.id,
              cells: [
                category.name,
                category.description,
                formatArchivedAt(category.archivedAt),
              ],
              onRestore: () => restoreMenuCategory(category.id),
            }))}
          />
        </AdminPanel>
      )}

      {tab === "staff" && (
        <AdminPanel title="Archived Staff Accounts" subtitle="Restore staff access">
          <ArchiveTable
            emptyMessage="No archived staff accounts."
            headers={["Name", "Email", "Role", "Archived", "Actions"]}
            rows={archivedStaff.map((account) => ({
              id: account.id,
              cells: [
                account.name,
                account.email,
                account.role,
                formatArchivedAt(account.archivedAt),
              ],
              onRestore: () => restoreStaffAccount(account.id),
            }))}
          />
        </AdminPanel>
      )}

      {tab === "orders" && (
        <div className="space-y-5">
          <AdminPanel title="Archived Store Orders" subtitle="Old in-store / pickup orders">
            <ArchiveTable
              emptyMessage="No archived store orders."
              headers={["Order ID", "Time", "Items", "Total", "Archived", "Actions"]}
              rows={archivedStoreOrders.map((order) => ({
                id: order.id,
                cells: [
                  order.orderId,
                  order.time,
                  order.items,
                  `₱${order.total.toLocaleString()}`,
                  formatArchivedAt(order.archivedAt),
                ],
                onRestore: () => restoreStoreOrder(order.id),
              }))}
            />
          </AdminPanel>

          <AdminPanel title="Archived Delivery Orders" subtitle="Old delivery orders">
            <ArchiveTable
              emptyMessage="No archived delivery orders."
              headers={["Order", "Customer", "Status", "Total", "Archived", "Actions"]}
              rows={archivedDeliveryOrders.map((order) => ({
                id: order.id,
                cells: [
                  order.orderNumber,
                  order.customerName,
                  deliveryStatusLabels[order.status],
                  `₱${order.total.toLocaleString()}`,
                  formatArchivedAt(order.archivedAt),
                ],
                onRestore: () => restoreDeliveryOrder(order.id),
              }))}
            />
          </AdminPanel>
        </div>
      )}
    </>
  );
}

function ArchiveTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: {
    id: string;
    cells: string[];
    onRestore: () => void;
  }[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto px-2 pb-2">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="admin-table-head text-muted">
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-3 font-medium ${
                  index === 0 ? "rounded-l-lg" : ""
                } ${index === headers.length - 1 ? "rounded-r-lg" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-accent/5 last:border-0">
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.id}-${index}`}
                  className={`px-4 py-3 ${index === 0 ? "font-medium text-[#800000]" : "text-muted"}`}
                >
                  {cell}
                </td>
              ))}
              <td className="px-4 py-3">
                <RestoreButton onRestore={row.onRestore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
