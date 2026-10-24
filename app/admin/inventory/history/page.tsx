"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, Download, History, RefreshCw, Search } from "lucide-react";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminData } from "@/context/AdminDataContext";
import type { StockMovement, StockMovementPage } from "@/lib/admin/types";
import {
  FILTER_CONTROL_CLASS,
  STOCK_MOVEMENT_TYPES,
  fmtQty,
  formatLayerDate,
  formatMovementDateTime,
  getExpiryStatus,
  getStockMovementBadge,
  movementTotalCost,
  peso,
  signedQty,
} from "@/lib/admin/inventory-utils";

/* ══════════════════════════════════════════════════════════════
   Inventory History (A4) — dense, server-paginated movement ledger.
   GET /api/stock/movements?itemId=&type=&from=&to=&staffId=&page=&limit=
   via fetchStockMovementsPage(); local UI state only. Read-only.
   ══════════════════════════════════════════════════════════════ */

const CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const CARD_HEAD = "p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50";

// Safety cap for the CSV export walk (100 pages × up to 100 rows per page).
const MAX_EXPORT_PAGES = 100;

/** RFC 4180 escaping: quote a field only when required, doubling embedded quotes. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "ADJUSTMENT_ADD,ADJUSTMENT_REMOVE", label: "All Adjustments" },
  ...STOCK_MOVEMENT_TYPES.map((t) => ({
    value: t as string,
    label: getStockMovementBadge(t).label,
  })),
];

export default function InventoryHistoryPage() {
  const { stockItems, staffAccounts, fetchStockMovementsPage, salesEventsVersion, getActiveMenuItems } = useAdminData();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const linkedMenuMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of getActiveMenuItems()) {
      if (item.stockItemId) map.set(item.stockItemId, item.name);
    }
    return map;
  }, [getActiveMenuItems]);
  const toggleRow = (id: string) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const sortedItems = useMemo(
    () => [...stockItems].sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems],
  );
  const sortedStaff = useMemo(
    () => [...staffAccounts].filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [staffAccounts],
  );

  // Filters (page 1 whenever these change)
  const [itemFilter, setItemFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StockMovementPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const isDefaultView =
    !itemFilter && !typeFilter && !fromDate && !toDate && !staffFilter && !search;

  const load = useCallback(
    async (targetPage: number) => {
      setRefreshing(true);
      const res = await fetchStockMovementsPage({
        page: targetPage,
        limit: 20,
        itemId: itemFilter || undefined,
        type: typeFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        staffId: staffFilter || undefined,
        search: search || undefined,
      });
      if (res) {
        setResult(res);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
      setRefreshing(false);
      setLoading(false);
    },
    [fetchStockMovementsPage, itemFilter, typeFilter, fromDate, toDate, staffFilter, search],
  );

  // Debounced load (300ms) — typing in search or paging never fires per
  // keystroke. Same pattern as the staff order-history search.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void load(page);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, itemFilter, typeFilter, fromDate, toDate, staffFilter, search, load, salesEventsVersion]);

  // Any filter change goes back to page 1.
  const resetToFirstPage = () => setPage(1);

  const refreshClick = useCallback(() => {
    void load(page);
  }, [load, page]);

  const [exporting, setExporting] = useState(false);

  // ── Export CSV ────────────────────────────────────────────────────────
  // Exports ALL movement rows matching the current filters (item, type,
  // date range, staff, search) — NOT just the loaded table page. The ledger
  // is server-paginated, so the export re-walks the same API: page 1 asks
  // for the biggest page size (the shared fetcher clamps to ≤100), then
  // every later page follows the limit the SERVER echoes back in
  // pagination.limit, so page offsets always line up with the backend even
  // if it clamps the requested size. Rows are de-duplicated by id as a
  // safety net and the walk is capped at MAX_EXPORT_PAGES responses; if
  // that cap truncates the result set, the toast says so instead of
  // writing a silently-partial file.
  const exportCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows: StockMovement[] = [];
      const seen = new Set<string>();
      const filterArgs = {
        itemId: itemFilter || undefined,
        type: typeFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        staffId: staffFilter || undefined,
        search: search || undefined,
      };
      let pageSize = 100;
      let expectedTotal = 0;
      for (let pageNo = 1; pageNo <= MAX_EXPORT_PAGES; pageNo++) {
        const res = await fetchStockMovementsPage({
          page: pageNo,
          limit: pageSize,
          ...filterArgs,
        });
        if (!res) throw new Error("movement fetch failed");
        if (pageNo === 1) expectedTotal = Number(res.pagination.total) || 0;
        pageSize = Math.max(1, Number(res.pagination.limit) || pageSize);
        for (const m of res.movements) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            rows.push(m);
          }
        }
        if (pageNo >= Math.max(1, Number(res.pagination.totalPages) || 1)) break;
      }

      // Columns mirror the ledger table. Raw values for spreadsheets:
      // ISO-8601 date (sortable), unformatted numbers (no ₱ symbol, no
      // thousand separators), type as the same label the table shows.
      const header = [
        "Date / Time",
        "Item",
        "Type",
        "Received Date",
        "Expiry Date",
        "Qty Change",
        "Balance After",
        "Unit Cost",
        "Total Cost",
        "Staff",
        "Reason",
        "Reference",
      ];
      const lines = [header.map(csvField).join(",")];
      for (const m of rows) {
        const qty = Number(m.quantityChange);
        const bal = Number(m.balanceAfter);
        const total = movementTotalCost(m);
        lines.push(
          [
            m.createdAt ?? "",
            m.itemName ?? "",
            getStockMovementBadge(m.type).label,
            m.receivedAt ?? "",
            m.expiryDate ?? "",
            Number.isFinite(qty) ? String(qty) : String(m.quantityChange ?? ""),
            Number.isFinite(bal) ? String(bal) : String(m.balanceAfter ?? ""),
            m.unitCost != null ? String(Number(m.unitCost)) : "",
            total != null ? String(total) : "",
            m.createdByName ?? "",
            m.reason ?? "",
            m.reference ?? "",
          ]
            .map(csvField)
            .join(","),
        );
      }

      // BOM so Excel renders ₱ / en-dashes correctly; CRLF per RFC 4180.
      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      // inventory-history-YYYY-MM-DD.csv — local date (admin's wall clock).
      const pad = (n: number) => String(n).padStart(2, "0");
      const now = new Date();
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      anchor.download = `inventory-history-${stamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(
        expectedTotal > rows.length
          ? `Exported ${rows.length.toLocaleString("en-PH")} of ${expectedTotal.toLocaleString("en-PH")} matching movements (page cap).`
          : `Exported ${rows.length.toLocaleString("en-PH")} movements.`,
      );
    } catch {
      toast.error("Export failed — couldn't load some movements.");
    } finally {
      setExporting(false);
    }
  }, [exporting, fetchStockMovementsPage, itemFilter, typeFilter, fromDate, toDate, staffFilter, search]);

  const movements = result?.movements ?? [];
  const pagination = result?.pagination ?? null;
  const totalPages = pagination?.totalPages ?? 1;

  const clearFilters = useCallback(() => {
    setItemFilter("");
    setTypeFilter("");
    setFromDate("");
    setToDate("");
    setStaffFilter("");
    setSearch("");
    setPage(1);
  }, []);

  const badgeFor = (m: StockMovement) => getStockMovementBadge(m.type);

  return (
    <div className="space-y-6">
      <AdminBackLink />

      <AdminPageHeader
        title="Inventory History"
        subtitle="Full stock movement ledger — filter by item, type, date range and staff."
        badge="Operations"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/15 bg-white px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={refreshClick}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className={CARD}>
        {/* Card header */}
        <div className={CARD_HEAD}>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Movement Ledger</h2>
            {fetchFailed ? (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Load Failed
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Live Data
              </span>
            )}
          </div>
          {result && (
            <span className="text-xs font-bold text-stone-400">
              {Number(pagination?.total ?? 0).toLocaleString("en-PH")} movement
              {Number(pagination?.total ?? 0) === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Filters row */}
        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by item"
            value={itemFilter}
            onChange={(e) => {
              setItemFilter(e.target.value);
              resetToFirstPage();
            }}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All Items</option>
            {sortedItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by movement type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              resetToFirstPage();
            }}
            className={FILTER_CONTROL_CLASS}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <label htmlFor="inv-filter-from" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              From
            </label>
            <input
              id="inv-filter-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                resetToFirstPage();
              }}
              className={FILTER_CONTROL_CLASS}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="inv-filter-to" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              To
            </label>
            <input
              id="inv-filter-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                resetToFirstPage();
              }}
              className={FILTER_CONTROL_CLASS}
            />
          </div>

          <select
            aria-label="Filter by staff"
            value={staffFilter}
            onChange={(e) => {
              setStaffFilter(e.target.value);
              resetToFirstPage();
            }}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All Staff</option>
            {sortedStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search item…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetToFirstPage();
              }}
              className={`${FILTER_CONTROL_CLASS} pl-8 w-44`}
            />
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={isDefaultView}
            className="text-xs font-bold text-stone-500 enabled:hover:text-[#800000] enabled:hover:underline underline-offset-2 disabled:opacity-40 disabled:cursor-default"
          >
            Clear Filters
          </button>
        </div>

        {/* Failure banner */}
        {fetchFailed && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <span>Couldn&apos;t load movements — check the connection.</span>
            <button onClick={refreshClick} className="font-bold underline hover:text-amber-900 ml-2">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading movements...</div>
        ) : movements.length === 0 ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">
            {isDefaultView
              ? typeFilter.includes("ADJUSTMENT")
                ? "No adjustments recorded"
                : "No movements yet"
              : typeFilter.includes("ADJUSTMENT")
                ? "No adjustments match the applied filters."
                : "No movements match the applied filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">Date / Time</th>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Expiry</th>
                  <th className="px-3 py-2.5 text-right">Qty Change</th>
                  <th className="px-3 py-2.5 text-right">Balance After</th>
                  <th className="px-3 py-2.5 text-right">Unit Cost</th>
                  <th className="px-3 py-2.5 text-right">Total Cost</th>
                  <th className="px-3 py-2.5">Staff</th>
                  <th className="px-3 py-2.5">Reason</th>
                  <th className="px-3 py-2.5">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.map((m) => {
                  const badge = badgeFor(m);
                  const change = Number(m.quantityChange);
                  const total = movementTotalCost(m);
                  const expanded = expandedRows[m.id] === true;
                  const expiryStatus = getExpiryStatus(m.expiryDate);
                  const isStockInOrAdd = m.type === "STOCK_IN" || m.type === "ADJUSTMENT_ADD";
                  return (
                    <Fragment key={m.id}>
                      <tr className="hover:bg-stone-50 transition-colors">
                        <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">
                          {formatMovementDateTime(m.createdAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`movement-details-${m.id}`}
                            aria-label={`${expanded ? "Hide" : "Show"} details for ${m.itemName}`}
                            onClick={() => toggleRow(m.id)}
                            className="group inline-flex items-center gap-1.5 -mx-1 rounded-md px-1 py-0.5 font-bold text-stone-900 hover:text-[#800000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000]/40"
                          >
                            {m.itemName}
                            {linkedMenuMap.has(m.stockItemId) && (
                              <span
                                className="ml-1 inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider bg-[#800000]/10 text-[#800000] border border-[#800000]/20"
                                title={`Linked to Menu Item: "${linkedMenuMap.get(m.stockItemId)}"`}
                              >
                                Menu
                              </span>
                            )}
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-stone-400 transition-transform group-hover:text-[#800000] ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {isStockInOrAdd && m.expiryDate ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-700">
                                {formatLayerDate(m.expiryDate)}
                              </span>
                              {expiryStatus && (
                                <span className={expiryStatus.badgeClass}>
                                  {expiryStatus.badgeLabel}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                            change > 0 ? "text-emerald-700" : change < 0 ? "text-rose-600" : "text-stone-600"
                          }`}
                        >
                          {signedQty(m.quantityChange)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-stone-900 whitespace-nowrap">
                          {fmtQty(m.balanceAfter)}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {m.unitCost != null ? peso(m.unitCost) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {total != null ? peso(total) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700 font-semibold whitespace-nowrap">
                          {m.createdByName || <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 max-w-[160px] truncate">
                          {m.reason || <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-stone-500 max-w-[140px] truncate">
                          {m.reference || <span className="text-stone-400">—</span>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr id={`movement-details-${m.id}`} className="bg-stone-50/80">
                          <td colSpan={11} className="px-3 pb-3 pt-2">
                            <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                                Movement Details
                              </p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
                                <div>
                                  <span className="block text-[10px] font-semibold text-stone-400 uppercase">Received Date</span>
                                  <span className="font-semibold text-stone-700">
                                    {m.receivedAt ? formatLayerDate(m.receivedAt) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-semibold text-stone-400 uppercase">Expiry Date</span>
                                  <span className="font-semibold text-stone-700">
                                    {m.expiryDate ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        {formatLayerDate(m.expiryDate)}
                                        {expiryStatus && (
                                          <span className={expiryStatus.badgeClass}>
                                            {expiryStatus.badgeLabel}
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-semibold text-stone-400 uppercase">Supplier</span>
                                  <span className="font-semibold text-stone-700">
                                    {(() => {
                                      if (!m.reference) return "—";
                                      if (m.reference.includes(" — ")) return m.reference.split(" — ")[0];
                                      return m.type === "STOCK_IN" ? m.reference : "—";
                                    })()}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-semibold text-stone-400 uppercase">Unit Cost</span>
                                  <span className="font-semibold text-stone-700">
                                    {m.unitCost != null ? peso(m.unitCost) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-semibold text-stone-400 uppercase">Note</span>
                                  <span className="font-semibold text-stone-700">
                                    {(() => {
                                      if (m.reference && m.reference.includes(" — ")) {
                                        return m.reference.split(" — ").slice(1).join(" — ");
                                      }
                                      return m.reason || (m.type !== "STOCK_IN" ? m.reference : null) || "—";
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 border-t border-stone-100">
            <button
              type="button"
              disabled={page <= 1 || refreshing}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 disabled:cursor-default"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-stone-600">
              Page {pagination.page} of {totalPages} · Total {Number(pagination.total).toLocaleString("en-PH")}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || refreshing}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 disabled:cursor-default"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
