import { redirect } from "next/navigation";

/* Request-time render so GET emits a real HTTP redirect instead of a
 * statically-prerendered flight payload. */
export const dynamic = "force-dynamic";

/* Legacy standalone Customers page — customers now live under the
 * User Management sidebar group at /admin/users/customers (tab components
 * reused, mirroring the Inventory section). */
export default function AdminCustomersLegacyPage() {
  redirect("/admin/users/customers");
}
