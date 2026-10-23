"use client";

/**
 * POS Cashier inside the Owner Portal (/admin/pos).
 *
 * Reuses the shared staff POS component directly — no copied POS code.
 * Route access is admin-gated by app/admin/layout.tsx (non-admins are
 * redirected), so this stays admin-only.
 *
 * All data wiring (categories/products, shift polling, checkout, Paid
 * Today) lives inside POSCashierTab; the root AdminDataProvider /
 * NetworkStatusProvider / AuthProvider and this layout's ConfirmProvider
 * cover every context the tab consumes, with getStaffOrAdminToken()
 * resolving the admin JWT for each API call.
 *
 * Wrapper notes: the admin layout already supplies page padding
 * (px-4 … lg:px-8), centering (max-w-6xl), the sidebar chrome, and the
 * mobile nav — so no extra horizontal padding here, and deliberately NO
 * AdminPageHeader (the card carries its own shift header; an extra header
 * would double up).
 */
import { POSCashierTab } from "@/components/staff/POSCashierTab";

export default function AdminPosPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <POSCashierTab />
    </div>
  );
}
