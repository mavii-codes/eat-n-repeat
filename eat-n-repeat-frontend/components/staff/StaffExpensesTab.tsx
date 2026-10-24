"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Wallet,
  Plus,
  RefreshCw,
  Search,
  DollarSign,
  Receipt,
  CreditCard,
  X,
} from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";
import { useAuth } from "@/context/AuthContext";
import type { ExpenseItem, ExpensesSummary } from "@/lib/admin/types";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryChip,
  expenseSourceChip,
  expenseStatusChip,
} from "@/lib/admin/expense-utils";
import {
  formatMovementDateTime,
  peso,
  phNowLocalInput,
} from "@/lib/admin/inventory-utils";
import {
  StaffPanel,
  staffThead,
  staffTh,
  staffTd,
  staffRow,
  staffEmptyCell,
  staffControl,
} from "@/components/staff/StaffPanel";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";

type StaffExpensesTabProps = {
  staffName: string;
};

export function StaffExpensesTab({ staffName }: StaffExpensesTabProps) {
  const { user } = useAuth();
  const { fetchExpenses, fetchExpensesSummary, createAdminExpense } = useAdminData();

  /* ── Filter & Search State ── */
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ── Result Data ── */
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);

  /* ── Add Expense Modal ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [payee, setPayee] = useState("");
  const [paymentSource, setPaymentSource] = useState<"cash_drawer" | "other">("cash_drawer");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Initialize today's date
  useEffect(() => {
    setDate(phNowLocalInput().slice(0, 10));
  }, []);

  const loadExpenses = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const res = await fetchExpenses({
          page: targetPage,
          limit: 20,
          from: fromDate || undefined,
          to: toDate || undefined,
          category: categoryFilter || undefined,
          paymentSource: sourceFilter || undefined,
        });

        if (res) {
          setExpenses(res.expenses);
          setTotalRecords(res.total);
          setTotalPages(res.totalPages);
          if (res.summary) setSummary(res.summary);
        }
      } catch (err) {
        console.error("Failed to fetch expenses:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchExpenses, fromDate, toDate, categoryFilter, sourceFilter]
  );

  const loadSummary = useCallback(async () => {
    try {
      const sum = await fetchExpensesSummary(
        fromDate || undefined,
        toDate || undefined
      );
      if (sum) setSummary(sum);
    } catch (err) {
      console.error("Failed to fetch expense summary:", err);
    }
  }, [fetchExpensesSummary, fromDate, toDate]);

  useEffect(() => {
    loadExpenses(page);
    loadSummary();
  }, [loadExpenses, loadSummary, page]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses(page);
    loadSummary();
  };

  /* ── Form Validation ── */
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
      next.date = !date ? "Pick a date." : "Date cannot be in the future.";
    }
    if (!amountValid) {
      next.amount = "Enter a valid amount (greater than 0).";
    }
    if (!category) next.category = "Please select an expense category.";
    if (!reasonValid) {
      next.reason =
        reason.trim().length < 3
          ? "Reason must be at least 3 characters."
          : "Reason cannot exceed 500 characters.";
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const handleCreateExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (validate() || submitting) return;

    setSubmitting(true);
    try {
      const res = await createAdminExpense({
        date: date || undefined,
        amount: amountNum,
        category,
        payee: payee.trim() || undefined,
        paymentSource,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });

      if (res.ok) {
        toast.success(
          res.message.trim()
            ? res.message
            : `Expense recorded: ${peso(amountNum)} for ${category}`,
          { duration: 5000 }
        );
        // Reset form
        setAmount("");
        setPayee("");
        setCategory("");
        setReason("");
        setNote("");
        setPaymentSource("cash_drawer");
        setErrors({});
        setIsModalOpen(false);
        // Refresh list
        setPage(1);
        loadExpenses(1);
        loadSummary();
      } else {
        toast.error(res.message || "Failed to record expense.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to record expense.");
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side search filtering
  const displayedExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (exp) =>
        exp.reason?.toLowerCase().includes(q) ||
        exp.payee?.toLowerCase().includes(q) ||
        exp.category?.toLowerCase().includes(q) ||
        exp.note?.toLowerCase().includes(q) ||
        exp.createdByName?.toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  // Derived totals
  const drawerTotal = useMemo(() => {
    return expenses
      .filter((e) => (e.source === "drawer" || e.paymentSource === "cash_drawer") && e.status !== "voided")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const otherTotal = useMemo(() => {
    return expenses
      .filter((e) => e.source !== "drawer" && e.paymentSource !== "cash_drawer" && e.status !== "voided")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">
            <Wallet className="h-3.5 w-3.5 text-accent" /> Expenses
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">
            Café Expenses &amp; Paid-Outs
          </h1>
          <p className="text-sm text-muted">
            Record operating expenses, drawer cash paid-outs, and monitor expense history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60 cursor-pointer"
            title="Refresh expenses"
          >
            <RefreshCw className={`h-4 w-4 text-stone-500 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Total Net Expenses</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-[#800000]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-[#800000]">
            {peso(summary?.total ?? (drawerTotal + otherTotal))}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Active café operating disbursements
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Cash Drawer Paid-Outs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-stone-800">
            {peso(drawerTotal)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Paid from POS cashier shifts
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Other / Petty Cash</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-stone-800">
            {peso(otherTotal)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Direct &amp; petty cash payments
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Total Recorded</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-stone-800">
            {summary?.count ?? totalRecords}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Logged expense transactions
          </p>
        </div>
      </div>

      {/* Expense Log Table Panel */}
      <StaffPanel
        icon={<Receipt className="h-5 w-5 text-[#800000]" />}
        title="Expense Records &amp; History"
        subtitle="Detailed log of all café operational expenses"
      >
        {/* Filters Bar */}
        <div className="p-4 border-b border-stone-100 bg-white flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reason, payee, or note..."
              aria-label="Search expenses"
              className={`${staffControl} w-full pl-9`}
            />
          </div>

          <AdminSelect
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="!py-2 !text-xs max-w-[160px]"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </AdminSelect>

          <AdminSelect
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="!py-2 !text-xs max-w-[150px]"
          >
            <option value="">All Sources</option>
            <option value="cash_drawer">Cash Drawer</option>
            <option value="other">Other / Petty</option>
          </AdminSelect>

          {(searchQuery || categoryFilter || sourceFilter || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("");
                setSourceFilter("");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              className="inline-flex items-center gap-1 text-xs text-[#800000] hover:underline font-semibold cursor-pointer"
            >
              <X className="h-3 w-3" /> Clear Filters
            </button>
          )}
        </div>

        {/* Table Content */}
        <div className="p-2 overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className={staffThead}>
                <th className={staffTh}>Date &amp; Time</th>
                <th className={staffTh}>Category</th>
                <th className={staffTh}>Description &amp; Payee</th>
                <th className={staffTh}>Source</th>
                <th className={staffTh}>Recorded By</th>
                <th className={staffTh}>Status</th>
                <th className={`${staffTh} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#800000]" />
                      Loading expense records...
                    </div>
                  </td>
                </tr>
              ) : displayedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className={staffEmptyCell}>
                    No expense records found matching your filters.
                  </td>
                </tr>
              ) : (
                displayedExpenses.map((row) => {
                  const catChipClass = expenseCategoryChip().className;
                  const srcChip = expenseSourceChip(row);
                  const stChip = expenseStatusChip(row);
                  return (
                    <tr key={row.id} className={staffRow}>
                      <td className={`${staffTd} text-xs whitespace-nowrap text-stone-500 font-mono`}>
                        {formatMovementDateTime(row.expenseDate || row.createdAt)}
                      </td>
                      <td className={staffTd}>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${catChipClass}`}
                        >
                          {row.category}
                        </span>
                      </td>
                      <td className={`${staffTd} text-xs max-w-[240px]`}>
                        <p className="font-semibold text-stone-900 leading-snug">{row.reason}</p>
                        {row.payee && (
                          <p className="text-[11px] text-stone-500 mt-0.5">Payee: {row.payee}</p>
                        )}
                        {row.note && (
                          <p className="text-[11px] text-stone-400 italic mt-0.5 truncate">{row.note}</p>
                        )}
                      </td>
                      <td className={staffTd}>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${srcChip.className}`}
                        >
                          {srcChip.label}
                        </span>
                      </td>
                      <td className={`${staffTd} text-xs text-stone-600 whitespace-nowrap`}>
                        {row.createdByName || "Staff"}
                      </td>
                      <td className={staffTd}>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${stChip.className}`}
                        >
                          {stChip.label}
                        </span>
                      </td>
                      <td className={`${staffTd} text-right font-mono font-bold text-sm whitespace-nowrap ${
                        row.status === "voided" ? "text-stone-400 line-through" : "text-[#800000]"
                      }`}>
                        {peso(row.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-4 py-3 text-xs text-stone-600">
            <span>
              Page {page} of {totalPages} ({totalRecords} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </StaffPanel>

      {/* Modal: Record New Expense */}
      <AdminModal
        open={isModalOpen}
        title="Record Café Expense"
        onClose={() => {
          if (!submitting) setIsModalOpen(false);
        }}
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <AdminButton
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </AdminButton>
            <AdminButton
              type="button"
              variant="primary"
              onClick={() => void handleCreateExpense()}
              disabled={submitting || !amountValid || !reasonValid || !category}
            >
              {submitting ? "Recording..." : "Save Expense"}
            </AdminButton>
          </div>
        }
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <AdminField label="Date *">
                <AdminInput
                  type="date"
                  value={date}
                  max={phToday}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (errors.date) setErrors((prev) => ({ ...prev, date: null }));
                  }}
                  required
                />
              </AdminField>
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>

            <div>
              <AdminField label="Amount (₱) *">
                <AdminInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
                  }}
                  placeholder="0.00"
                  required
                />
              </AdminField>
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-medium">Quick Amount:</span>
            {[50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setAmount(amt.toString());
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
                }}
                className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-[#800000] hover:text-white hover:border-[#800000] transition-colors cursor-pointer"
              >
                ₱{amt}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <AdminField label="Category *">
                <AdminSelect
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (errors.category) setErrors((prev) => ({ ...prev, category: null }));
                  }}
                  required
                >
                  <option value="">Select a category...</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
            </div>

            <div>
              <AdminField label="Payment Source *">
                <AdminSelect
                  value={paymentSource}
                  onChange={(e) => setPaymentSource(e.target.value as "cash_drawer" | "other")}
                  required
                >
                  <option value="cash_drawer">Cash Drawer (POS Shift Paid-Out)</option>
                  <option value="other">Other / Petty Cash / Owner</option>
                </AdminSelect>
              </AdminField>
            </div>
          </div>

          <AdminField label="Payee / Vendor (Optional)">
            <AdminInput
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="e.g. Public Market, Ice Supplier, Water Refilling"
            />
          </AdminField>

          <div>
            <AdminField label="Reason / Description *">
              <AdminInput
                type="text"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason) setErrors((prev) => ({ ...prev, reason: null }));
                }}
                placeholder="e.g. Bought extra disposable cups and tissue paper"
                required
              />
            </AdminField>
            {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason}</p>}
          </div>

          <AdminField label="Notes (Optional)">
            <AdminTextarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Any additional details or receipt reference..."
            />
          </AdminField>
        </form>
      </AdminModal>
    </div>
  );
}
