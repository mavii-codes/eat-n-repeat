"use client";

import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { AdminSelect, AdminTextarea } from "@/components/admin/AdminForm";
import { EXPENSE_DRAWER_CATEGORIES } from "@/lib/admin/expense-utils";
import { expenseRowsNet } from "@/lib/admin/expense-utils";

/* ══════════════════════════════════════════════════════════════
   ExpenseModal — staff drawer paid-out (POSCashierTab shift bar).
   Mirrors the CashModals EndShiftModal shell: z-[200] overlay,
   live X-read style summary card, concentrated money input.
   Drawer expenses are supported both online and offline (synced
   with the active shift to keep Expected Cash in balance).
   ══════════════════════════════════════════════════════════════ */

export type DrawerExpenseInput = {
  amount: number;
  category: string;
  reason: string;
  note?: string;
};

export type DrawerExpenseResult = {
  ok: boolean;
  message: string;
  shift: { expected_cash?: number | string; expenses?: unknown } | null;
};

/** ₱ with PH separators; "—" fallback for unreadable server values. */
function peso(value: unknown): string {
  const n = Number(value);
  return `₱${(Number.isFinite(n) ? n : 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const QUICK_AMOUNTS = [50, 100, 500];

export function ExpenseModal({
  open,
  shift,
  onSubmit,
  onClose,
}: {
  open: boolean;
  shift: any;
  onSubmit: (input: DrawerExpenseInput) => Promise<DrawerExpenseResult>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fresh form every time the modal opens.
  useEffect(() => {
    if (open) {
      setAmount("");
      setCategory("");
      setReason("");
      setNote("");
    }
  }, [open]);

  if (!open || !shift) return null;

  const openingFloat = Number(shift.starting_float) || 0;
  const expected = Number(shift.expected_cash) || 0;
  // Cash sales from the server split when available; otherwise derived so
  // the summary always balances (same convention as EndShiftModal).
  const cashSales = shift.cash_sales != null
    ? Number(shift.cash_sales) || 0
    : Math.max(0, expected - openingFloat);
  const netExpenses = Array.isArray(shift.expenses)
    ? expenseRowsNet(shift.expenses as never[])
    : Number(shift.expenses) || 0;

  const amountNum = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    /^\d+(\.\d{1,2})?$/.test(amount.trim());
  const reasonValid = reason.trim().length >= 3;
  const canSubmit = amountValid && reasonValid && category !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({
        amount: amountNum,
        category,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      if (result.ok) {
        const newExpected =
          result.shift && result.shift.expected_cash != null
            ? Number(result.shift.expected_cash)
            : null;
        const tail =
          newExpected != null && Number.isFinite(newExpected)
            ? ` New expected cash: ${peso(newExpected)}.`
            : "";
        toast.success(
          result.message?.trim()
            ? result.message
            : `Expense recorded — ${category} ${peso(amountNum)}.${tail}`,
          { duration: 8000 },
        );
        onClose();
      } else {
        toast.error(result.message || "Failed to record the expense.");
      }
    } catch {
      toast.error("Network error — expense not recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 disabled:opacity-40"
          aria-label="Close expense form"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#800000]/10 text-[#800000]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
              <path d="M12 3v18M17 7a4 4 0 0 0-4-2H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" />
            </svg>
          </span>
          <h2 className="text-xl font-bold text-stone-900">Record Expense</h2>
        </div>
        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-5">
          Drawer Paid-Out — Live Shift Summary
        </p>

        {/* Summary card: expected / cash sales / expenses from the active shift */}
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-stone-500">Cash Sales (+)</span>
            <span className="font-bold text-emerald-700">{peso(cashSales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Expenses Paid Out (−)</span>
            <span className="font-bold text-amber-700">{peso(netExpenses)}</span>
          </div>
          <div className="border-t border-stone-200 my-2 pt-2 flex justify-between">
            <span className="text-stone-700 font-bold uppercase text-[10px]">Expected Cash in Drawer</span>
            <span className="font-bold text-[#800000] text-lg">{peso(expected)}</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Amount + quick chips */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Amount Paid Out (₱)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-2xl font-bold p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#800000] focus:border-[#800000] outline-none"
            />
            {amount.trim() !== "" && !amountValid && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                Enter an amount greater than 0 with at most 2 decimals.
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {QUICK_AMOUNTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAmount(String(chip))}
                  className="px-3 py-1 rounded-full border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700 hover:border-[#800000]/40 hover:bg-white transition-colors cursor-pointer"
                >
                  ₱{chip}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Category</label>
            <AdminSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {EXPENSE_DRAWER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </AdminSelect>
          </div>

          {/* Reason — required, ≥3 chars */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Reason (required)</label>
            <AdminTextarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bought ice for the juice station"
            />
            {reason.trim() !== "" && !reasonValid && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                Reason must be at least 3 characters.
              </p>
            )}
          </div>

          {/* Note — optional */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Note (optional)</label>
            <AdminTextarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Receipt attached to the shift folder"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 bg-[#800000] hover:bg-[#630000] text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Recording…" : "Record Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
