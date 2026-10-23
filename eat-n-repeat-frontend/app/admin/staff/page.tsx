import { redirect } from "next/navigation";

/* Request-time render so GET emits a real HTTP redirect instead of a
 * statically-prerendered flight payload. */
export const dynamic = "force-dynamic";

/* Legacy standalone Staff Accounts page — staff now lives under the
 * User Management sidebar group at /admin/users/staff (tab components
 * reused, mirroring the Inventory section). */
export default function StaffAccountsPage() {
  redirect("/admin/users/staff");
}
