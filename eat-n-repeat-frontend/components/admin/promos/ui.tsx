"use client";

/* Promo Codes — shared visual primitives. Everything reuses the admin
   design system (stone + [#800000] maroon, rounded chips, admin-table-head):
   no new design language. The generic toolbar primitives mirror
   components/admin/users/ui so both pages render identically. */

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

/* Status pill with the promo palette:
   ACTIVE green · PAUSED stone · SCHEDULED amber · EXPIRED red · USED_UP stone */
export function PromoStatusPill({ status }: { status: string | null | undefined }) {
  const key = (status || "ACTIVE").toUpperCase();
  const configs: Record<string, { cls: string; label: string }> = {
    ACTIVE: { cls: "bg-green-100 text-green-800 ring-green-200", label: "Active" },
    PAUSED: { cls: "bg-stone-100 text-stone-600 ring-stone-300", label: "Paused" },
    SCHEDULED: { cls: "bg-amber-100 text-amber-800 ring-amber-200", label: "Scheduled" },
    EXPIRED: { cls: "bg-red-100 text-red-700 ring-red-200", label: "Expired" },
    USED_UP: { cls: "bg-red-50 text-red-700 ring-red-100", label: "Used up" },
  };
  const c = configs[key] ?? {
    cls: "bg-stone-100 text-stone-600 ring-stone-300",
    label: key,
  };
  return (
    <span className={`${pill} ${c.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {c.label}
    </span>
  );
}

export function ChannelChip({ channel }: { channel: string | null | undefined }) {
  const key = (channel ?? "BOTH").toUpperCase();
  const configs: Record<string, { cls: string; label: string }> = {
    ONLINE: { cls: "bg-blue-50 text-blue-700 ring-blue-200", label: "Online only" },
    POS: { cls: "bg-purple-50 text-purple-700 ring-purple-200", label: "POS only" },
    BOTH: { cls: "bg-stone-50 text-stone-600 ring-stone-200", label: "Online & POS" },
  };
  const c = configs[key] ?? configs.BOTH;
  return <span className={`${pill} ${c.cls}`}>{c.label}</span>;
}

export function AudienceChip({ audience }: { audience: string | null | undefined }) {
  const loggedIn = (audience ?? "EVERYONE").toUpperCase() === "LOGGED_IN";
  return (
    <span
      className={`${pill} ${
        loggedIn
          ? "bg-accent-light text-accent ring-accent/25"
          : "bg-stone-50 text-stone-600 ring-stone-200"
      }`}
    >
      {loggedIn ? "Logged-in only" : "Everyone"}
    </span>
  );
}

/* Redemption status chip (RESERVED / APPLIED / RELEASED). */
export function RedemptionChip({ status }: { status: string | null | undefined }) {
  const key = (status ?? "").toUpperCase();
  const configs: Record<string, { cls: string; label: string }> = {
    RESERVED: { cls: "bg-amber-100 text-amber-800 ring-amber-200", label: "Reserved" },
    APPLIED: { cls: "bg-green-100 text-green-800 ring-green-200", label: "Applied" },
    RELEASED: { cls: "bg-stone-100 text-stone-600 ring-stone-300", label: "Released" },
  };
  const c = configs[key] ?? {
    cls: "bg-stone-100 text-stone-600 ring-stone-300",
    label: key || "—",
  };
  return <span className={`${pill} ${c.cls}`}>{c.label}</span>;
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
