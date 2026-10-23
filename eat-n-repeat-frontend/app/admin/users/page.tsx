import { redirect } from "next/navigation";

/* Request-time render so GET emits a real HTTP redirect instead of a
 * statically-prerendered flight payload. */
export const dynamic = "force-dynamic";

/* User Management index — the tabbed page moved to sidebar sub-pages
 * (mirroring the Inventory section); /admin/users now lands on Staff. */
export default function UsersIndexPage() {
  redirect("/admin/users/staff");
}
