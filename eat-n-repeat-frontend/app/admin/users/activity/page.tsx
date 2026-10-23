"use client";

/* Activity log — User Management sub-page (sidebar, mirroring Inventory).
 * The tab component is reused as-is: paginated audit entries with action /
 * actor filters — nothing re-implemented here. */

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ActivityTab from "@/components/admin/users/ActivityTab";

export default function ActivityUsersPage() {
  return (
    <>
      <AdminPageHeader
        badge="Audit"
        title="Activity log"
        subtitle="Audit trail of account activity in the café."
      />
      <ActivityTab />
    </>
  );
}
