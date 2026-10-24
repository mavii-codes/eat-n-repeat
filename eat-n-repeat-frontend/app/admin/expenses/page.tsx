"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Wallet, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import type { ExpenseItem, ExpensesSummary } from "@/lib/admin/types";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryChip,
  expenseSourceChip,
  expenseStatusChip,
} from "@/lib/admin/expense-utils";
import {
  FILTER_CONTROL_CLASS,
  formatMovementDateTime,
  peso,
  phNowLocalInput,
} from "@/lib/admin/inventory-utils";

/* ══════════════════════════════════════════════════════════════
   Admin Expenses (Phase B) — the org-wide expense log:
   admin "Other"-source entries + staff drawer paid-outs, with
   void/reversal history. Data: GET/POST /api/expenses (+ /:id/void,
   /:id/reverse) via the context helpers. All money from the server.
   ══════════════════════════════════════════════════════════════ */

const CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const CARD_HEAD = "p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50";

type ExpensesResult = {
  expenses: ExpenseItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: ExpensesSummary;
};

export default function ExpensesPage() {
  const { fetchExpenses, fetchExpensesSummary, createAdminExpense, voidExpense } = useAdminData();

  /* ── Add Expense form ── */
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [payee, setPayee] = useState("");
  const [paymentSource, setPaymentSource] = useState<"other" | "cash_drawer">("other");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  /* ── List + filters ── */
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ExpensesResult | null>(null);
  const [stockPurchases, setStockPurchases] = useState<{
    total: number;
    count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [recorderFilter, setRecorderFilter] = useState("");

  /* ── Void (reason) modal ── */
  const [voidTarget, setVoidTarget] = useState<ExpenseItem | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Hydration-safe default: PH today, set after mount.
  useEffect(() => {
    setDate(phNowLocalInput().slice(0, 10));
  }, []);

  const load = useCallback(
    async (targetPage: number) => {
      const res = await fetchExpenses({
        page: targetPage,
        limit: 20,
        from: fromDate || undefined,
        to: toDate || undefined,
        category: categoryFilter || undefined,
        paymentSource: sourceFilter || undefined,
        createdById: recorderFilter || undefined,
      });
      if (res) {
        setResult(res);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
      setLoading(false);
    },
    [fetchExpenses, fromDate, toDate, categoryFilter, sourceFilter, recorderFilter],
  );

  // Debounced 300ms fetch — same pattern as the inventory history page.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void load(page);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, fromDate, toDate, categoryFilter, sourceFilter, recorderFilter, load]);

  // Stock purchases live outside the expense ledger and only the summary
  // endpoint reports them. Follow the same date range as the log; hide the
  // line entirely when an older backend omits the field.
  const loadStockPurchases = useCallback(async () => {
    const summary = await fetchExpensesSummary(
      fromDate || undefined,
      toDate || undefined,
    );
    setStockPurchases(summary?.stockPurchases ?? null);
  }, [fetchExpensesSummary, fromDate, toDate]);

  useEffect(() => {
    void loadStockPurchases();
  }, [loadStockPurchases]);

  const resetToFirstPage = () => setPage(1);

  const refreshClick = useCallback(() => {
    void load(page);
    void loadStockPurchases();
  }, [load, page, loadStockPurchases]);

  const rows = result?.expenses ?? [];
  const summary = result?.summary ?? null;
  // Prefer the dedicated summary endpoint; fall back to the list payload if a
  // future backend includes it there too.
  const stockPurchasesShown = stockPurchases ?? summary?.stockPurchases ?? null;
  const pagination = result ? result : null;
  const totalPages = result?.totalPages ?? 1;

  const isDefaultView =
    !fromDate && !toDate && !categoryFilter && !sourceFilter && !recorderFilter;

  // Recorder options derived from the loaded rows (createdById + name).
  const recorders = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.createdById && row.createdByName && !map.has(row.createdById)) {
        map.set(row.createdById, row.createdByName);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  /* ── Form validation ── */
  const phToday = phNowLocalInput().slice(0, 10);
  const amountNum = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    /^\d+(\.\d{1,2})?$/.test(amount.trim());
  const dateValid = date !== "" && date <= phToday;
  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 500;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!dateValid) {
      next.date = !date ? "Pick a date." : "Date can't be in the future.";
    }
    if (!amountValid) {
      next.amount = "Enter an amount greater than 0 with at most 2 decimals.";
    }
    if (!category) next.category = "Pick a category.";
    if (!reasonValid) {
      next.reason =
        reason.trim().length < 3 ? "Reason must be at least 3 characters." : "Reason is too long.";
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const submit = useCallback(async () => {
    if (validate() || submitting) return;
    setSubmitting(true);
    try {
      const res = await createAdminExpense({
        date: date || undefined,
        amount: amountNum,
        category,
        payee: payee || undefined,
        paymentSource,
        reason: reason.trim(),
        note: note || undefined,
      });
      if (res.ok) {
        toast.success(
          res.message.trim()
            ? res.message
            : `Expense recorded — ${category} ${peso(amountNum)}.`,
          { duration: 8000 },
        );
        setAmount("");
        setPayee("");
        setCategory("");
        setReason("");
        setNote("");
        setErrors({});
        setPage(1);
        void load(1);
      } else {
        toast.error(res.message || "Failed to record the expense.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [amountNum, category, createAdminExpense, date, load, note, payee, paymentSource, reason, submitting, validate]);

  /* ── Void flow ── */
  const openVoid = useCallback((row: ExpenseItem) => {
    setVoidTarget(row);
    setVoidReason("");
    setVoidError(null);
  }, []);

  const closeVoid = useCallback(() => {
    setVoidTarget(null);
    setVoidReason("");
    setVoidError(null);
  }, []);

  const confirmVoid = useCallback(async () => {
    if (!voidTarget) return;
    if (voidReason.trim().length < 3) {
      setVoidError("Reason must be at least 3 characters.");
      return;
    }
    setVoidSubmitting(true);
    try {
      const res = await voidExpense(voidTarget.id, voidReason.trim());
      if (res.ok) {
        toast.success(res.message || "Expense voided.", { duration: 8000 });
        closeVoid();
        void load(page);
      } else {
        setVoidError(res.message);
        toast.error(res.message);
      }
    } finally {
      setVoidSubmitting(false);
    }
  }, [voidTarget, voidReason, voidExpense, closeVoid, load, page]);

  const canVoid = (row: ExpenseItem): boolean => {
    const reversal =
      row.kind === "reversal" || (row.reversalOfId != null && row.kind !== "expense");
    return row.status === "active" && row.paymentSource === "other" && !reversal;
  };

  const inlineError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors[key]}</p> : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Expenses"
        subtitle="Paid-outs and log entries across shifts — drawer and admin records."
        badge="Finance"
        action={
          <button
            type="button"
            onClick={refreshClick}
            disabled={loading && !result}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5 items-start">
        {/* ── Add Expense form ── */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#800000]" />
              <h2 className="font-bold text-stone-800">Add Expense</h2>
            </div>
          </div>
          <form
            className="p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Date">
                <input
                  type="date"
                  value={date}
                  max={phToday}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrors((p) => ({ ...p, date: null }));
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 outline-none focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000]"
                />
                {inlineError("date")}
              </AdminField>
              <AdminField label="Amount (₱)">
                <AdminInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((p) => ({ ...p, amount: null }));
                  }}
                />
                {inlineError("amount")}
              </AdminField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Category">
                <AdminSelect
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setErrors((p) => ({ ...p, category: null }));
                  }}
                >
                  <option value="">Select a category…</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </AdminSelect>
                {inlineError("category")}
              </AdminField>
              <AdminField label="Payee (optional)">
                <AdminInput
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Motorcraft"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                />
              </AdminField>
            </div>

            <AdminField label="Payment source">
              <AdminSelect
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value === "cash_drawer" ? "cash_drawer" : "other")}
              >
                <option value="other">Other</option>
                <option value="cash_drawer">Cash drawer</option>
              </AdminSelect>
              {paymentSource === "cash_drawer" && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                  Pulls from the open shift&apos;s Expected — the drawer must be open.
                </p>
              )}
            </AdminField>

            <AdminField label="Reason">
              <AdminTextarea
                maxLength={500}
                placeholder="e.g. Weekly supply run for packaging"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((p) => ({ ...p, reason: null }));
                }}
                rows={2}
              />
              {inlineError("reason")}
            </AdminField>

            <AdminField label="Note (optional)">
              <AdminTextarea
                maxLength={500}
                placeholder="e.g. OR #1234 filed in the binder"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </AdminField>

            <div className="flex justify-end pt-1">
              <AdminButton
                type="submit"
                disabled={submitting || !dateValid || !amountValid || !category || !reasonValid}
              >
                {submitting ? "Recording…" : "Record Expense"}
              </AdminButton>
            </div>
          </form>
        </div>

        {/* ── Expense log ── */}
        <div className={`${CARD} lg:col-span-3`}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#800000]" />
              <h2 className="font-bold text-stone-800">Expense Log</h2>
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
            {summary && (
              <span className="text-xs font-bold text-stone-500">
                Total (filtered, active):{" "}
                <span className="text-[#800000] font-black">{peso(summary.total)}</span>
                {" · "}
                {Number(summary.count).toLocaleString("en-PH")}
              </span>
            )}
          </div>

          {stockPurchasesShown && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-stone-100 bg-stone-50/40 px-4 py-2 text-[11px] font-semibold text-stone-500">
              <span>Stock purchases (Inventory — not included in expenses)</span>
              <span className="font-black tabular-nums text-stone-700">
                {peso(stockPurchasesShown.total)}
              </span>
              <span aria-hidden="true" className="text-stone-400">
                ·
              </span>
              <span>
                {Number(stockPurchasesShown.count).toLocaleString("en-PH")}{" "}
                {Number(stockPurchasesShown.count) === 1 ? "purchase" : "purchases"}
              </span>
            </div>
          )}

          {/* Filters row */}
          <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="exp-from" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                From
              </label>
              <input
                id="exp-from"
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
              <label htmlFor="exp-to" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                To
              </label>
              <input
                id="exp-to"
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
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                resetToFirstPage();
              }}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by payment source"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                resetToFirstPage();
              }}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All Sources</option>
              <option value="cash_drawer">Cash drawer</option>
              <option value="other">Other</option>
            </select>

            <select
              aria-label="Filter by recorder"
              value={recorderFilter}
              onChange={(e) => {
                setRecorderFilter(e.target.value);
                resetToFirstPage();
              }}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All Recorders</option>
              {recorders.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setCategoryFilter("");
                setSourceFilter("");
                setRecorderFilter("");
                setPage(1);
              }}
              disabled={isDefaultView}
              className="text-xs font-bold text-stone-500 enabled:hover:text-[#800000] enabled:hover:underline underline-offset-2 disabled:opacity-40 disabled:cursor-default"
            >
              Clear Filters
            </button>
          </div>

          {/* Failure banner */}
          {fetchFailed && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <span>Couldn&apos;t load expenses — check the connection.</span>
              <button onClick={refreshClick} className="font-bold underline hover:text-amber-900 ml-2">
                Retry
              </button>
            </div>
          )}

          {loading && !result ? (
            <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading expenses...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-stone-400 font-bold text-sm">
              {isDefaultView
                ? "No expenses recorded yet."
                : "No expenses match the applied filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Payee</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Recorded By</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => {
                    const source = expenseSourceChip(row);
                    const status = expenseStatusChip(row);
                    const reversal = status.label === "↺ Reversal";
                    const voided = row.status === "voided";
                    return (
                      <tr key={row.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">
                          {formatMovementDateTime(row.expenseDate || row.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <span className={expenseCategoryChip().className}>{row.category || "—"}</span>
                          <p className="mt-0.5 text-[10px] text-stone-500 truncate" title={row.reason}>
                            {row.reason || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-stone-700 font-semibold">
                          {row.payee || <span className="text-stone-400">—</span>}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                            voided ? "text-stone-400 line-through" : reversal ? "text-emerald-700" : "text-stone-900"
                          }`}
                        >
                          {voided
                            ? `₱${(Number(row.amount) || 0).toFixed(2)}`
                            : `${reversal ? "+" : ""}₱${(Number(row.amount) || 0).toFixed(2)}`}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={source.className}>{source.label}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-stone-800">{row.createdByName || "—"}</span>
                          {row.createdByRole && (
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              {row.createdByRole}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={status.className} title={status.title}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {canVoid(row) ? (
                            <button
                              type="button"
                              onClick={() => openVoid(row)}
                              className="px-2 py-1 bg-white border border-rose-300 text-rose-700 rounded-lg text-[10px] font-bold hover:bg-rose-50 transition-colors"
                            >
                              Void
                            </button>
                          ) : (
                            <span className="text-stone-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
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
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 disabled:cursor-default"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-stone-600">
                Page {page} of {totalPages} · Total {Number(result?.total ?? 0).toLocaleString("en-PH")}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 disabled:cursor-default"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Void reason modal ── */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-5 relative">
            <button
              onClick={closeVoid}
              className="absolute top-3.5 right-3.5 text-stone-400 hover:text-stone-700"
              aria-label="Close void form"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-stone-900">Void Expense</h2>
            <p className="text-xs text-stone-500 mt-0.5 mb-4">
              {peso(voidTarget.amount)} — {voidTarget.category}
              {voidTarget.payee ? ` · ${voidTarget.payee}` : ""}
            </p>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Reason
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={voidReason}
              onChange={(e) => {
                setVoidReason(e.target.value);
                setVoidError(null);
              }}
              placeholder="e.g. Duplicate entry — recorded twice for the same receipt"
              className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000] outline-none resize-none"
            />
            {voidError && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">{voidError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeVoid}
                disabled={voidSubmitting}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmVoid()}
                disabled={voidSubmitting || voidReason.trim().length < 3}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {voidSubmitting ? "Voiding…" : "Void Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
