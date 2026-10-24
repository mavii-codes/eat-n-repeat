"use client";

/* User Management — Activity tab. Server-paginated audit log from
   /api/admin/users/activity with action/date/search filters. */

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminForm";
import { fetchActivityPage } from "./api";
import { formatPhDateTime } from "@/lib/admin/delivery-utils";
import { humanizeAction, actionTone, metaSummary } from "./format";
import { useUserList } from "./use-user-list";
import { ACTIVITY_ACTIONS, type ActivityRow, type UserListQuery } from "./types";
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

const ACTION_OPTIONS = ["all", ...ACTIVITY_ACTIONS] as const;

export default function ActivityTab() {
  const [applied, setApplied] = useState({
    page: 1,
    search: "",
    action: "all",
    from: "",
    to: "",
  });

  const query = useMemo<UserListQuery>(
    () => ({
      page: applied.page,
      limit: LIMIT,
      search: applied.search,
      action: applied.action,
      from: applied.from,
      to: applied.to,
    }),
    [applied],
  );

  const { data, loading, error, refresh } = useUserList<ActivityRow>(
    fetchActivityPage,
    query,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  function update(patch: Partial<typeof applied>) {
    setApplied((prev) => ({ ...prev, page: 1, ...patch }));
  }
  function handlePage(next: number) {
    setApplied((prev) => ({ ...prev, page: Math.max(1, next) }));
  }

  return (
    <AdminPanel
      title="Activity Log"
      subtitle={data ? `${total} note${total === 1 ? "" : "s"}` : undefined}
      action={<RefreshButton busy={loading} onClick={refresh} />}
    >
      {/* Toolbar: action / date range / search */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <ToolbarSelect
            value={applied.action}
            onChange={(value) => update({ action: value })}
          >
            <option value="all">All actions</option>
            {ACTION_OPTIONS.filter((a) => a !== "all").map((action) => (
              <option key={action} value={action}>
                {humanizeAction(action)}
              </option>
            ))}
          </ToolbarSelect>
          <div className="flex items-center gap-2">
            <div>
              <label className="sr-only">From</label>
              <input
                type="date"
                value={applied.from}
                onChange={(e) => update({ from: e.target.value })}
                className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000]"
              />
            </div>
            <span className="text-xs font-semibold text-stone-400">to</span>
            <div>
              <label className="sr-only">To</label>
              <input
                type="date"
                value={applied.to}
                onChange={(e) => update({ to: e.target.value })}
                className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000]"
              />
            </div>
          </div>
          <SearchInput
            onCommit={(value) => update({ search: value })}
            placeholder="Search actor, target…"
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && rows.length === 0 && <TableSkeleton rows={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title="No activity recorded"
          hint="Try a different date range, action, or search."
        />
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div
          className={`hidden md:block overflow-x-auto px-3 pb-2 ${
            loading ? "pointer-events-none opacity-60 transition-opacity" : ""
          }`}
        >
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-stone-500 border-b border-stone-200">
                <th className="rounded-tl-xl px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="rounded-tr-xl px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors ${
                    i < 10 ? "animate-in fade-in duration-300" : ""
                  }`}
                  style={i < 10 ? { animationDelay: `${i * 24}ms` } : undefined}
                >
                  <td className="px-4 py-3 text-xs font-medium text-stone-600 whitespace-nowrap">
                    {formatPhDateTime(row.createdAt) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-stone-700">
                      {row.actorName || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold ${actionTone(row.action)}`}
                    >
                      {humanizeAction(row.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-stone-700">
                        {row.targetName || row.targetId || "—"}
                      </span>
                      {row.targetType && (
                        <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                          {row.targetType}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[320px]">
                    <p
                      className="text-xs text-stone-500 truncate"
                      title={metaSummary(row.meta)}
                    >
                      {metaSummary(row.meta)}
                    </p>
                  </td>
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
              <div className="flex justify-between items-start gap-3 mb-2">
                <span className={`text-xs font-bold ${actionTone(row.action)}`}>
                  {humanizeAction(row.action)}
                </span>
                <span className="text-[10px] text-stone-400 font-medium text-right whitespace-nowrap">
                  {formatPhDateTime(row.createdAt) || "—"}
                </span>
              </div>
              <p className="text-xs font-semibold text-stone-700">
                {row.actorName || "—"}
                {row.targetName ? ` — ${row.targetName}` : ""}
              </p>
              <p className="text-xs text-stone-500 mt-1 break-words">
                {metaSummary(row.meta)}
              </p>
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
