"use client";

/* User Management — shared visual primitives. Everything reuses the admin
   design system (stone + [#800000] maroon, rounded chips, admin-table-head):
   no new design language. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Search,
} from "lucide-react";

/* ── Pills & chips ──────────────────────────────────────────────────────── */

const pill =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1";

export function StatusPill({ status }: { status: string | null | undefined }) {
  const active = (status || "active").toLowerCase() === "active";
  return (
    <span
      className={`${pill} ${
        active
          ? "bg-green-100 text-green-800 ring-green-200"
          : "bg-stone-100 text-stone-600 ring-stone-300"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const labels: Record<string, string> = {
    admin: "Admin",
    head_staff: "Head Staff",
    staff: "Staff",
    delivery_rider: "Delivery Rider",
  };
  const key = (role ?? "").toLowerCase();
  return (
    <span
      className={`${pill} ${
        key === "admin"
          ? "bg-accent-light text-accent ring-accent/25"
          : key === "head_staff"
            ? "bg-amber-100 text-amber-800 ring-amber-200"
            : "bg-stone-100 text-stone-600 ring-stone-300"
      }`}
    >
      {labels[key] ?? role ?? "—"}
    </span>
  );
}

export function OpenShiftChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      Open shift
    </span>
  );
}

export function UnpaidOrdersChip({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      {count} unpaid {count === 1 ? "order" : "orders"}
    </span>
  );
}

/* Small amber marker for customer rows with an open review flag
   (row.openFlag on the customers list). Same amber family as the
   unpaid-orders chip so the status cell stays readable. */
export function FlaggedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
      Flagged
    </span>
  );
}

/* ── Inputs — the same staff-page toolbar look ─────────────────────────── */

export function SearchInput({
  onCommit,
  placeholder,
  className = "",
}: {
  onCommit: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounce when the field unmounts (tab switch).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const fire = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    onCommit(raw.trim());
  };

  return (
    <div className={`relative w-full sm:w-64 ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => fire(next), 450);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") fire(value);
        }}
        className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] transition-colors shadow-sm"
      />
    </div>
  );
}

export function ToolbarSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[120px] ${className}`}
    >
      {children}
    </select>
  );
}

export function SortDirButton({
  dir,
  onToggle,
}: {
  dir: "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dir === "asc" ? "Sorted A to Z / oldest first" : "Sorted Z to A / newest first"}
      className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs font-bold text-stone-500 hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
    >
      {dir === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function RefreshButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Refresh"
      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-60 sm:self-auto focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
    >
      <RotateCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      Refresh
    </button>
  );
}

/* ── Panel helpers ─────────────────────────────────────────────────────── */

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-3 flex items-center gap-4 px-1">
          <div className="h-9 w-44 shrink-0 rounded-xl bg-stone-200/60 animate-pulse" />
          <div className="h-6 w-24 shrink-0 rounded-full bg-stone-200/60 animate-pulse" />
          <div className="hidden h-6 w-28 shrink-0 rounded-full bg-stone-200/60 animate-pulse sm:block" />
          <div className="h-6 flex-1 shrink-0 rounded-full bg-stone-200/40 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-stone-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-3 my-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-bold text-red-800">Could not load this list.</p>
          <p className="text-xs text-red-700">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/40"
      >
        Retry
      </button>
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex flex-col gap-3 border-t border-stone-200/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-stone-500">
        {total === 0
          ? "No results"
          : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || total === 0}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Prev
        </button>
        <span className="text-xs font-semibold text-stone-400">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || total === 0}
          onClick={() => onPage(page + 1)}
          className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Clipboard with a plain-text fallback (HTTP LAN contexts) ───────────── */

export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
