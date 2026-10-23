"use client";

/* Staff — User Management sub-page (sidebar, mirroring Inventory).
 * The tab component is reused as-is: search, role/status filters, sort,
 * password resets, enable/disable — nothing re-implemented here. */

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import StaffTab from "@/components/admin/users/StaffTab";

export default function StaffUsersPage() {
  return (
    <>
      <AdminPageHeader
        badge="Team"
        title="Staff"
        subtitle="Staff directory with roles, status, sorting, password resets, and disable."
      />
      <StaffTab />
    </>
  );
}
