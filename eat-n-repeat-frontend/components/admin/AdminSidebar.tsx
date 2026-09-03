"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/context/AuthContext";
import { LocalModeModal } from "@/components/admin/LocalModeModal";
import { Server } from "lucide-react";

const navGroups = [
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
    ],
  },
  {
    label: "Operations",
    items: [
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
        href: "/admin/stock",
        label: "Stock / Inventory",
        description: "Manage inventory",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
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
        href: "/admin/staff",
        label: "Staff Accounts",
        description: "Team management",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/delivery") return pathname === "/admin/delivery";
  return pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isLocalModeModalOpen, setIsLocalModeModalOpen] = useState(false);

  return (
    <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white">
      <LocalModeModal isOpen={isLocalModeModalOpen} onClose={() => setIsLocalModeModalOpen(false)} />
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
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-item flex items-center gap-3 rounded-xl px-3 py-3 ${
                      active ? "admin-nav-item-active text-white" : "text-white/70"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-accent text-white" : "bg-white/8 text-white/80"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs text-white/45">
                        {item.description}
                      </span>
                    </span>
                  </Link>
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
              onClick={() => setIsLocalModeModalOpen(true)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 py-2 text-xs font-semibold text-emerald-100 transition-all hover:bg-emerald-600/40 active:scale-[0.98] cursor-pointer"
            >
              <Server className="h-3.5 w-3.5" />
              Switch to Local Mode
            </button>
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
