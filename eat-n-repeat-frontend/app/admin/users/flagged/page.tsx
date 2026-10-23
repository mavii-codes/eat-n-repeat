"use client";

/* Flagged — User Management sub-page (sidebar, mirroring Inventory).
 * The tab component is reused as-is: open flags review, resolve, dismiss —
 * nothing re-implemented here. The sidebar badge counts open flags. */

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import FlagsTab from "@/components/admin/users/FlagsTab";

export default function FlaggedUsersPage() {
  return (
    <>
      <AdminPageHeader
        badge="Trust"
        title="Flagged"
        subtitle="Open customer flags with review and resolve actions."
      />
      <FlagsTab />
    </>
  );
}
