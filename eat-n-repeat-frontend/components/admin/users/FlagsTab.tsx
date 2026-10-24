"use client";

/* User Management — Flagged tab. Customer review flags from
   /api/admin/users/flags with Open/Dismissed sub-filters, outcome filter,
   search, and the admin-only approve / keep-watching / dismiss actions.
   Same design language as the other tabs (stone + maroon, pills,
   admin-table-head, ConfirmDialog confirmAction). */

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, Flag } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { AdminPanel } from "@/components/admin/AdminForm";
import { fetchFlagsPage, resolveFlag } from "./api";
import { formatPhDateTime } from "@/lib/admin/delivery-utils";
import { flagRuleLabel } from "./format";
import { useUserList } from "./use-user-list";
import { notifyFlagsChanged } from "./use-open-flag-count";
import type { FlagRow, UserListQuery } from "./types";
import {
  EmptyState,
  ErrorBanner,
  Pagination,
  RefreshButton,
  SearchInput,
  TableSkeleton,
  ToolbarSelect,
} from "./ui";

const LIMIT = 20;

/* Outcome chip tones: Pending = maroon, Approved = amber,
   Watching = a calm stone-blue (all from the existing pill palette). */
const chipBase =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1";
const OUTCOME_CHIPS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-accent-light text-accent ring-accent/25" },
  approved: { label: "Approved", className: "bg-amber-100 text-amber-800 ring-amber-200" },
  watching: { label: "Watching", className: "bg-sky-100 text-sky-700 ring-sky-200" },
};

function OutcomeChip({ outcome }: { outcome: string | null | undefined }) {
  const key = (outcome ?? "").toLowerCase();
  const known = OUTCOME_CHIPS[key] ?? OUTCOME_CHIPS.pending;
  return (
    <span className={`${chipBase} ${known.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
      {known.label}
    </span>
  );
}

function OpenUnpaidChip({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      {count} unpaid {count === 1 ? "order" : "orders"}
    </span>
  );
}

export default function FlagsTab() {
  const { confirmAction } = useConfirm();

  const [applied, setApplied] = useState({
    page: 1,
    search: "",
    flagStatus: "open", // Open | Dismissed sub-filter
    outcome: "all", // All / Pending / Approved / Watching
  });

  const query = useMemo<UserListQuery>(
    () => ({
      page: applied.page,
      limit: LIMIT,
      search: applied.search,
      flagStatus: applied.flagStatus,
      outcome: applied.outcome,
    }),
    [applied],
  );

  const { data, loading, error, refresh } = useUserList<FlagRow>(
    fetchFlagsPage,
    query,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const dismissed = applied.flagStatus === "dismissed";

  /* Expandable reason rows (Set of flag ids). */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleReason(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function update(patch: Partial<typeof applied>) {
    setApplied((prev) => ({ ...prev, page: 1, ...patch }));
  }
  function handlePage(next: number) {
    setApplied((prev) => ({ ...prev, page: Math.max(1, next) }));
  }

  /* ── Admin decisions (errors surface verbatim inside the dialog) ────── */

  async function handleResolve(
    row: FlagRow,
    action: "approve" | "watch" | "dismiss",
  ) {
    const customerName = row.customer?.name || "this customer";
    const copy = {
      approve: {
        title: `Approve flag on ${customerName}?`,
        message: "Confirm this flag? The customer stays flagged on record.",
        confirmLabel: "Approve",
        workingLabel: "Approving",
        variant: "warning" as const,
      },
      watch: {
        title: `Keep watching ${customerName}?`,
        message:
          "Mark to auto-clear once their open unpaid orders drop to 1 or 0.",
        confirmLabel: "Keep watching",
        workingLabel: "Updating",
        variant: "info" as const,
      },
      dismiss: {
        title: `Dismiss flag on ${customerName}?`,
        message: "Dismiss as false alarm.",
        confirmLabel: "Dismiss",
        workingLabel: "Dismissing",
        variant: "info" as const,
      },
    }[action];

    const confirmed = await confirmAction({
      ...copy,
      action: async () => {
        const result = await resolveFlag(row.id, action);
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      notifyFlagsChanged();
      toast.success(
        action === "approve"
          ? "Flag approved."
          : action === "watch"
            ? "Flag set to keep watching."
            : "Flag dismissed.",
      );
      refresh();
    }
  }

  /* ── Render pieces ─────────────────────────────────────────────────── */

  const reporterLabel = (row: FlagRow) => {
    if ((row.flaggedByKind ?? "").toLowerCase() === "system") return "System";
    return row.flaggedByName || "Staff";
  };

  const reasonCell = (row: FlagRow, wide: boolean) => {
    const text = (row.reason ?? "").trim() || "—";
    const isLong = text.length > 96;
    const isOpen = expanded.has(row.id);
    const showFull = isOpen || !wide;
    return (
      <div className={wide ? "max-w-[360px]" : ""}>
        <p
          className={`text-xs text-stone-600 ${showFull ? "break-words" : "truncate"}`}
          title={showFull ? undefined : text}
        >
          {text}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => toggleReason(row.id)}
            className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-accent hover:underline cursor-pointer focus:outline-none"
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-3 w-3" /> Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> More
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const openUnpaid = (row: FlagRow) =>
    typeof row.openUnpaidOrders === "number" && row.openUnpaidOrders > 0;

  const actionButtons = (row: FlagRow, align: "right" | "left") => {
    const alignClass = align === "right" ? "justify-end" : "";
    if (dismissed) {
      return (
        <p className={`text-[11px] leading-4 text-stone-400 ${alignClass}`}>
          Resolved by{" "}
          <span className="font-semibold text-stone-500">
            {row.resolvedByName || "—"}
          </span>
          {row.resolvedAt && (
            <span> · {formatPhDateTime(row.resolvedAt)}</span>
          )}
        </p>
      );
    }
    return (
      <div className={`flex ${alignClass} gap-1.5`}>
        <FlagActionButton tone="accent" onClick={() => handleResolve(row, "approve")}>
          Approve
        </FlagActionButton>
        <FlagActionButton tone="sky" onClick={() => handleResolve(row, "watch")}>
          Keep watching
        </FlagActionButton>
        <FlagActionButton tone="red" onClick={() => handleResolve(row, "dismiss")}>
          Dismiss
        </FlagActionButton>
      </div>
    );
  };

  const headCols = dismissed ? (
    <>
      <th className="rounded-tl-xl px-4 py-3 font-medium">Customer</th>
      <th className="px-4 py-3 font-medium">Reason</th>
      <th className="px-4 py-3 font-medium">Reporter</th>
      <th className="px-4 py-3 font-medium">Filed</th>
      <th className="px-4 py-3 font-medium">Outcome</th>
      <th className="rounded-tr-xl px-4 py-3 font-medium text-right">Resolved</th>
    </>
  ) : (
    <>
      <th className="rounded-tl-xl px-4 py-3 font-medium">Customer</th>
      <th className="px-4 py-3 font-medium">Reason</th>
      <th className="px-4 py-3 font-medium">Reporter</th>
      <th className="px-4 py-3 font-medium">Filed</th>
      <th className="px-4 py-3 font-medium">Outcome</th>
      <th className="rounded-tr-xl px-4 py-3 font-medium text-right">Actions</th>
    </>
  );

  return (
    <AdminPanel
      title="Flagged Customers"
      subtitle={
        data
          ? dismissed
            ? `${total} dismissed flag${total === 1 ? "" : "s"}`
            : `${total} flag${total === 1 ? "" : "s"} under review`
          : undefined
      }
      action={<RefreshButton busy={loading} onClick={refresh} />}
    >
      {/* Toolbar: Open / Dismissed sub-filter + outcome + search */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
            {(
              [
                ["open", "Open"],
                ["dismissed", "Dismissed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={applied.flagStatus === value}
                onClick={() => update({ flagStatus: value })}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors focus:outline-none ${
                  applied.flagStatus === value
                    ? "bg-gradient-to-r from-accent to-accent-dark text-white"
                    : "text-stone-500 hover:bg-accent-light hover:text-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ToolbarSelect
            value={applied.outcome}
            onChange={(value) => update({ outcome: value })}
            className="min-w-[140px]"
          >
            <option value="all">All Outcomes</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="watching">Watching</option>
          </ToolbarSelect>
          <SearchInput
            onCommit={(value) => update({ search: value })}
            placeholder="Search customer, reason…"
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && rows.length === 0 && <TableSkeleton rows={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<Flag className="h-5 w-5" />}
          title={
            dismissed
              ? "No dismissed flags."
              : "No flags under review."
          }
          hint={
            dismissed
              ? "Dismissed flags are kept here for reference."
              : "When staff or the system flag a customer, it appears here."
          }
        />
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div
          className={`hidden md:block overflow-x-auto px-3 pb-2 ${
            loading ? "pointer-events-none opacity-60 transition-opacity" : ""
          }`}
        >
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-stone-500 border-b border-stone-200">
                {headCols}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-stone-100 last:border-0 align-top hover:bg-stone-50/50 transition-colors ${
                    i < 10 ? "animate-in fade-in duration-300" : ""
                  }`}
                  style={i < 10 ? { animationDelay: `${i * 24}ms` } : undefined}
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#800000]">
                      {row.customer?.name || "Customer"}
                    </span>
                    <span className="block text-xs text-stone-400">
                      {row.customer?.email || "—"}
                    </span>
                    <span className="block text-xs font-medium text-stone-600">
                      {row.customer?.phone || "No mobile number"}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                        {(row.customer?.status || "active").toLowerCase() ===
                        "active"
                          ? "Active"
                          : "Disabled"}
                      </span>
                      {openUnpaid(row) && (
                        <OpenUnpaidChip count={row.openUnpaidOrders as number} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">{reasonCell(row, true)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-stone-700">
                      {reporterLabel(row)}
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      {flagRuleLabel(row.rule) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 font-medium whitespace-nowrap">
                    {formatPhDateTime(row.flaggedAt) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeChip outcome={row.outcome} />
                  </td>
                  <td className="px-4 py-3">{actionButtons(row, "right")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {rows.length > 0 && (
        <div
          className={`md:hidden flex flex-col gap-3 p-3 ${
            loading ? "pointer-events-none opacity-60 transition-opacity" : ""
          }`}
        >
          {rows.map((row) => (
            <div
              key={row.id}
              className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h4 className="font-semibold text-[#800000] leading-tight">
                    {row.customer?.name || "Customer"}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {row.customer?.email || "—"}
                  </p>
                  <p className="text-xs font-medium text-stone-600">
                    {row.customer?.phone || "No mobile number"}
                  </p>
                </div>
                <OutcomeChip outcome={row.outcome} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  {(row.customer?.status || "active").toLowerCase() === "active"
                    ? "Active"
                    : "Disabled"}
                </span>
                {openUnpaid(row) && (
                  <OpenUnpaidChip count={row.openUnpaidOrders as number} />
                )}
              </div>

              <div className="mt-2 border-t border-stone-100 pt-2">
                {reasonCell(row, false)}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">
                    Reporter
                  </p>
                  <p className="text-xs font-semibold text-stone-700">
                    {reporterLabel(row)}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {flagRuleLabel(row.rule) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">
                    Filed
                  </p>
                  <p className="text-xs font-medium text-stone-700">
                    {formatPhDateTime(row.flaggedAt) || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-stone-100 pt-3">
                {actionButtons(row, "left")}
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <Pagination
          page={applied.page}
          limit={LIMIT}
          total={total}
          onPage={handlePage}
        />
      )}
    </AdminPanel>
  );
}

/* Small text action button in the CustomersTab ActionButton style.
   Tones follow the outcome chips: maroon = approve, sky = watch, red = dismiss. */
function FlagActionButton({
  tone,
  children,
  onClick,
}: {
  tone: "accent" | "sky" | "red";
  children: React.ReactNode;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    accent: "text-accent hover:bg-accent-light",
    sky: "text-sky-700 hover:bg-sky-50",
    red: "text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${tones[tone]} focus:outline-none focus:ring-2 focus:ring-[#800000]/20`}
    >
      {children}
    </button>
  );
}
