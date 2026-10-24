"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Flag, History, LayoutDashboard, PackagePlus, ScrollText, SlidersHorizontal, User, Users } from "lucide-react";
import {
  AdminNavItem,
  isNavItemActive,
  type AdminNavChild,
  type AdminNavItemData,
} from "@/components/admin/AdminNavItem";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/context/AuthContext";
import { useOpenFlagCount } from "@/components/admin/users/use-open-flag-count";

const navGroups: { label: string; items: AdminNavItemData[] }[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        description: "Business overview",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        href: "/admin/reports",
        label: "Reports & Sales",
        description: "Sales analytics",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M3 3v18h18" />
            <path d="M7 16l4-6 4 3 5-7" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/admin/cash",
        label: "Cash Management",
        description: "Shifts & Reconciliation",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M2 9h20M2 15h20" />
          </svg>
        ),
      },
      {
        href: "/admin/expenses",
        label: "Expenses",
        description: "Paid-outs & Expenses",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
            <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
          </svg>
        ),
      },
      {
        href: "/admin/promos",
        label: "Promo Codes",
        description: "Discounts & vouchers",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M3 9V7a2 2 0 0 1 2-2h5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1h5a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2h-5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" />
            <path d="M9.5 9.5l5 5M9.75 9.75h.01M14.25 14.25h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/pos",
        label: "POS Cashier",
        description: "Cash register & Paid Today",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M7 10V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5" />
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 14h8" />
            <path d="M8 17.5h.01M12 17.5h.01M16 17.5h.01" />
          </svg>
        ),
      },
      {
        href: "/admin/menu",
        label: "Menu Items",
        description: "Add / edit / delete",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        ),
      },
      {
        href: "/admin/categories",
        label: "Categories",
        description: "Menu groupings",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M4 7h7v7H4zM13 7h7v4h-7zM13 14h7v3h-7z" />
          </svg>
        ),
      },
      {
        href: "/admin/addons",
        label: "Add-ons",
        description: "Manage extras",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        href: "/admin/inventory",
        label: "Inventory",
        description: "Stock value & movements",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M9 12h6M9 16h4" />
          </svg>
        ),
        children: [
          {
            href: "/admin/inventory",
            label: "Inventory Dashboard",
            // Exact match — a prefix match would light this child on every
            // /admin/inventory/* sub-route.
            exact: true,
            icon: <LayoutDashboard className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/inventory/stock-in",
            label: "Stock In",
            icon: <PackagePlus className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/inventory/adjust",
            label: "Stock Adjustment",
            icon: <SlidersHorizontal className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/inventory/history",
            label: "Inventory History",
            icon: <History className="h-4 w-4" />,
          } satisfies AdminNavChild,
        ],
      },
      {
        href: "/admin/delivery",
        label: "Delivery",
        description: "Orders & status",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <rect x="1" y="3" width="15" height="13" rx="1" />
            <path d="M16 8h4l3 4v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        ),
      },
      {
        href: "/admin/delivery/settings",
        label: "Delivery Settings",
        description: "Fees & service areas",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
      {
        href: "/admin/delivery/reports",
        label: "Delivery Reports",
        description: "Generate reports",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        href: "/admin/archives",
        label: "Archives",
        description: "Restore archived data",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        ),
      },
      {
        href: "/admin/reviews",
        label: "Customer Reviews",
        description: "Manage customer feedback",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
      },

    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "User Management",
        description: "Staff, customers & activity",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8.5l2 2 3.5-3.5" />
          </svg>
        ),
        children: [
          {
            href: "/admin/users/staff",
            label: "Staff",
            icon: <Users className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/users/customers",
            label: "Customers",
            icon: <User className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/users/flagged",
            label: "Flagged",
            icon: <Flag className="h-4 w-4" />,
          } satisfies AdminNavChild,
          {
            href: "/admin/users/activity",
            label: "Activity log",
            icon: <ScrollText className="h-4 w-4" />,
          } satisfies AdminNavChild,
        ],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        description: "System configuration",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ),
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  // Open customer-flags count for the User Management badge. The hook itself
  // never polls for non-admin sessions and renders nothing at 0.
  const openFlagCount = useOpenFlagCount();

  // Inventory submenu: initialized open when already inside the section, and
  // re-opened on every navigation into /admin/inventory* — so it stays open
  // while hopping between dashboard / stock-in / adjust / history, while the
  // chevron still allows a manual close (until the next inbound navigation).
  const [inventoryOpen, setInventoryOpen] = useState(() =>
    isNavItemActive(pathname, "/admin/inventory")
  );
  useEffect(() => {
    // Deferred by a timer tick (like the history page's debounced load) so
    // the open state syncs on navigation without a cascading sync render.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setInventoryOpen(pathname.startsWith("/admin/inventory"));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  // User Management submenu: the same expand/keep-open contract as Inventory,
  // for /admin/users/staff /customers /flagged /activity.
  const [usersOpen, setUsersOpen] = useState(() =>
    isNavItemActive(pathname, "/admin/users")
  );
  useEffect(() => {
    // Same deferred timer tick as the Inventory effect above.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setUsersOpen(pathname.startsWith("/admin/users"));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white">
      <div className="border-b border-white/8 px-6 py-6">
        <Logo href="/admin" size="lg" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
          Owner Portal
        </p>
        <p className="mt-1 font-script text-xl text-white/90">Eat n&apos; Repeat</p>
      </div>

      <nav className="flex-1 space-y-6 px-4 py-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                // Each expandable group carries its own open state; the
                // Flagged child shares the live open-flag count with the
                // group badge (patches the static nav data at render time).
                const children =
                  item.href === "/admin/users"
                    ? item.children?.map((child) =>
                        child.href === "/admin/users/flagged"
                          ? { ...child, badge: openFlagCount ?? undefined }
                          : child,
                      )
                    : item.children;
                const groupOpen =
                  item.href === "/admin/inventory"
                    ? inventoryOpen
                    : item.href === "/admin/users"
                      ? usersOpen
                      : undefined;
                const onToggleGroup =
                  item.href === "/admin/inventory"
                    ? () => setInventoryOpen((v) => !v)
                    : item.href === "/admin/users"
                      ? () => setUsersOpen((v) => !v)
                      : undefined;
                return (
                <AdminNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  description={item.description}
                  icon={item.icon}
                  pathname={pathname}
                  badge={
                    item.href === "/admin/users"
                      ? openFlagCount ?? undefined
                      : undefined
                  }
                  open={item.children ? groupOpen : undefined}
                  onToggleOpen={
                    item.children ? onToggleGroup : undefined
                  }
                >
                  {children}
                </AdminNavItem>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/8 px-6 py-5 space-y-4">
        {user && (
          <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold text-white/95">{user.name}</p>
              <p className="text-[10px] text-white/40 font-mono">@{user.username} • {user.role}</p>
            </div>
            <button
              onClick={logout}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/20 border border-accent/30 py-2 text-xs font-semibold text-white transition-all hover:bg-accent/40 active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/8/50 px-4 py-2.5 backdrop-blur-sm text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Cordova Branch
          </p>
        </div>
      </div>
    </aside>
  );
}
