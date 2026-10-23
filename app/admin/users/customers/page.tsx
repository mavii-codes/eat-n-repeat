"use client";

/* Customers — User Management sub-page (sidebar, mirroring Inventory).
 * The tab component is reused as-is: search, status filters, phone edits,
 * enable/disable — nothing re-implemented here. */

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import CustomersTab from "@/components/admin/users/CustomersTab";

export default function CustomersUsersPage() {
  return (
    <>
      <AdminPageHeader
        badge="Accounts"
        title="Customers"
        subtitle="Customer accounts, status, and mobile numbers."
      />
      <CustomersTab />
    </>
  );
}
