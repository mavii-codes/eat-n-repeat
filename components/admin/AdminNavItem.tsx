"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   AdminNavItem — the row shared by every admin sidebar section.

   Flat rows render exactly like the original sidebar entries
   (10×10 icon tile + label + description). Rows with `children`
   render as an expandable BUTTON parent instead of a Link:
   the parent carries a chevron (down when closed, up when open —
   a rotating chevron-down), the submenu animates open/closed with
   a 220ms grid-template-rows ease, and the row keeps the stock
   dark-sidebar hover + active treatment. Children are indented,
   slightly smaller links; the active one is a solid maroon pill.

   Activity rules live in isNavItemActive (moved here from the
   sidebar so parent/child logic and the sidebar share one source).
   ══════════════════════════════════════════════════════════════ */

export type AdminNavChild = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Require an exact route match instead of a prefix match. */
  exact?: boolean;
  /** Optional live count badge (e.g. open flags on the Flagged child).
   *  Rendered as a maroon pill at the end of the row; hidden at 0. */
  badge?: number;
};

export type AdminNavItemData = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  children?: AdminNavChild[];
};

/** Same rules the sidebar has always used, now shared by item rows,
 *  parents and (prefixed) children. */
export function isNavItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/delivery") return pathname === "/admin/delivery";
  if (href === "/admin/settings") return pathname === "/admin/settings";
  return pathname.startsWith(href);
}

type AdminNavItemProps = {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  /** Current route — passed down by the sidebar (usePathname). */
  pathname: string;
  children?: AdminNavChild[];
  /** Open state of the submenu; controlled by the sidebar so it can
   *  auto-open on inbound navigation. Ignored for flat items. */
  open?: boolean;
  onToggleOpen?: () => void;
  /** Optional count badge (e.g. open customer flags on User Management).
   *  Rendered as a filled maroon dot pinned to the icon tile's corner;
   *  shown only when greater than 0. */
  badge?: number;
};

/* Small filled maroon count dot, shared by the flat and parent branches.
   The dark sidebar background gets a subtle dark ring so the maroon stays
   readable against both the active maroon tile and the dark tiles. */
function NavItemBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} items need attention`}
      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#800000] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-black/25"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminNavItem({
  href,
  label,
  description,
  icon,
  pathname,
  children,
  open = false,
  onToggleOpen,
  badge,
}: AdminNavItemProps) {
  const regionId = useId();
  const childListId = `admin-nav-children-${regionId}`;
  // Rendered only when a positive count reached the item.
  const showBadge = typeof badge === "number" && badge > 0;

  // ── Flat item: the original sidebar row, unchanged. ──
  if (!children || children.length === 0) {
    const active = isNavItemActive(pathname, href);
    return (
      <Link
        href={href}
        className={`admin-nav-item flex items-center gap-3 rounded-xl px-3 py-3 ${
          active ? "admin-nav-item-active text-white" : "text-white/70"
        }`}
      >
        <span
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-accent text-white" : "bg-white/8 text-white/80"
          }`}
        >
          {icon}
          {showBadge && <NavItemBadge count={badge} />}
        </span>
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-xs text-white/45">{description}</span>
        </span>
      </Link>
    );
  }

  // ── Parent item with an expandable submenu. ──
  const childIsActive = (child: AdminNavChild) =>
    child.exact ? pathname === child.href : isNavItemActive(pathname, child.href);
  const active =
    isNavItemActive(pathname, href) || children.some(childIsActive);

  return (
    <div>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-controls={childListId}
        className={`admin-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
          active ? "admin-nav-item-active text-white" : "text-white/70"
        }`}
      >
        <span
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-accent text-white" : "bg-white/8 text-white/80"
          }`}
        >
          {icon}
          {showBadge && <NavItemBadge count={badge as number} />}
        </span>
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-xs text-white/45">{description}</span>
        </span>
        {/* Chevron down when closed, up when open — a single rotating glyph. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Animated submenu: grid-template-rows 0fr → 1fr (~220ms). Falls back
          to an instant show/hide in engines without animateable fr rows;
          `inert` keeps the collapsed links out of the tab order. */}
      <div
        id={childListId}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-[220ms] ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {/* Indented children with a subtle tree rail. */}
          <div className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-2">
            {children.map((child) => {
              const isActive = childIsActive(child);
              const childBadgeCount =
                typeof child.badge === "number" && child.badge > 0
                  ? child.badge
                  : 0;
              const showChildBadge = childBadgeCount > 0;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "text-white/60 hover:bg-white/5 hover:text-white/85"
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      isActive ? "text-white" : "text-white/55"
                    }`}
                  >
                    {child.icon}
                  </span>
                  {child.label}
                  {showChildBadge && (
                    <span
                      aria-label={`${childBadgeCount} items need attention`}
                      className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#800000] px-1 text-[9px] font-bold leading-none text-white ring-1 ring-white/20"
                    >
                      {childBadgeCount > 99 ? "99+" : childBadgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
