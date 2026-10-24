"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MinusCircle, PlusCircle, SlidersHorizontal } from "lucide-react";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import type {
  StockAdjustReason,
  StockMovement,
} from "@/lib/admin/types";
import {
  fmtQty,
  getStockMovementBadge,
  signedQty,
} from "@/lib/admin/inventory-utils";

/* ══════════════════════════════════════════════════════════════
   Stock Adjustment (A3) — add/remove with a reason.
   POST /api/stock/items/:id/adjust via adjustStockItem(); 409 race
   (remove > on hand) surfaces the server message via toast.
   ══════════════════════════════════════════════════════════════ */

const CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const CARD_HEAD = "p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50";

const ADJUST_REASONS: StockAdjustReason[] = [
  "Spoilage",
  "Waste",
  "Breakage",
  "Expired",
  "Recount correction",
  "Found extra",
  "Other",
];

export default function AdjustStockPage() {
  const { stockItems, adjustStockItem } = useAdminData();

  const sortedItems = useMemo(
    () => [...stockItems].sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems],
  );

  const [itemId, setItemId] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState<StockAdjustReason | "">("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<StockMovement | null>(null);

  const selected = useMemo(
    () => sortedItems.find((i) => i.id === itemId) ?? null,
    [sortedItems, itemId],
  );

  const hasItems = sortedItems.length > 0;
  const onHand = selected ? Number(selected.quantity) : 0;
  const removeOverstock =
    direction === "remove" &&
    quantity !== "" &&
    Number.isFinite(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number(quantity) > onHand;

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!hasItems) next.itemId = "Create a stock item first.";
    if (!itemId) next.itemId = "Select an item.";
    const q = Number(quantity);
    if (!quantity.trim() || !Number.isFinite(q) || q <= 0) {
      next.quantity = "Quantity must be greater than 0.";
    } else if (Math.abs(q * 100 - Math.round(q * 100)) >= 1e-6) {
      next.quantity = "Quantity can have at most 2 decimal places.";
    }
    if (removeOverstock)
      next.quantity = "Cannot decrease more than is on hand.";
    if (!reason) next.reason = "Pick a reason.";
    if (reason === "Other" && !note.trim())
      next.note = "A note is required for “Other”.";
    if (direction === "add" && expiryDate) {
      const todayManila = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      if (expiryDate < todayManila) {
        next.expiryDate = "Expiry date cannot be in the past unless date received is also in the past.";
      }
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  }, [hasItems, itemId, quantity, removeOverstock, reason, note, direction, expiryDate]);

  const submit = useCallback(async () => {
    if (validate() || !selected || submitting) return;
    setSubmitting(true);
    try {
      const result = await adjustStockItem(selected.id, {
        direction,
        quantity: Number(quantity),
        reason: reason as StockAdjustReason,
        note: note || undefined,
        expiryDate: direction === "add" && expiryDate ? expiryDate : undefined,
      });
      if (result.ok && result.movement) {
        const unit =
          result.item?.unit && String(result.item.unit).trim()
            ? String(result.item.unit).trim()
            : selected.unit;
        const name = result.item?.name || selected.name;
        const newQty = result.item
          ? Number(result.item.quantity)
          : Number(result.movement.balanceAfter ?? 0);
        toast.success(
          `${direction === "add" ? "Increased" : "Decreased"} ${fmtQty(quantity)} ${unit} for ${name} — New balance: ${fmtQty(newQty)} ${unit}`,
          { duration: 8000 },
        );
        setReceipt(result.movement);
        setQuantity("");
        setExpiryDate("");
        setNote("");
        setReason("");
        setErrors({});
      } else {
        if (result.errors && result.errors.length > 0) {
          const nextErrors: Record<string, string> = {};
          for (const err of result.errors) {
            if (err.field && err.message) nextErrors[err.field] = err.message;
          }
          setErrors((prev) => ({ ...prev, ...nextErrors }));
        } else if (result.field && result.message) {
          setErrors((prev) => ({ ...prev, [result.field!]: result.message }));
        } else {
          toast.error(result.message || "Adjustment failed. Try again.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, adjustStockItem, direction, quantity, expiryDate, reason, note, validate]);

  const inlineError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p> : null;

  const receiptBadge = getStockMovementBadge(receipt?.type);

  return (
    <div className="space-y-6">
      <AdminBackLink />

      <AdminPageHeader
        title="Stock Adjustment"
        subtitle="Correct on-hand counts for spoilage, waste, breakage, recounts and more."
        badge="Operations"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Form ── */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#800000]" />
              <h2 className="font-bold text-stone-800">New Adjustment</h2>
            </div>
            {selected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-700 border border-stone-200">
                On hand: {fmtQty(onHand)} {selected.unit}
              </span>
            )}
          </div>

          <form
            className="p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {/* Direction toggle */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">Direction</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  disabled={!hasItems || submitting}
                  onClick={() => {
                    setDirection("add");
                    setErrors((p) => ({ ...p, quantity: null }));
                  }}
                  className={`py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                    direction === "add"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                >
                  <PlusCircle className="h-4 w-4" /> Increase
                </button>
                <button
                  type="button"
                  disabled={!hasItems || submitting}
                  onClick={() => {
                    setDirection("remove");
                    setErrors((p) => ({ ...p, quantity: null }));
                  }}
                  className={`py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                    direction === "remove"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                >
                  <MinusCircle className="h-4 w-4" /> Decrease
                </button>
              </div>
            </div>

            <AdminField label="Item">
              <AdminSelect
                value={itemId}
                disabled={!hasItems || submitting}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setErrors((p) => ({ ...p, itemId: null }));
                }}
              >
                <option value="">Select an item…</option>
                {sortedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </AdminSelect>
              {inlineError("itemId")}
            </AdminField>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label={`Quantity to ${direction === "add" ? "increase" : "decrease"}`}>
                <AdminInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={quantity}
                  disabled={!hasItems || submitting}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setErrors((p) => ({ ...p, quantity: null }));
                  }}
                />
                {removeOverstock ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    Cannot decrease more than is on hand ({fmtQty(onHand)} {selected?.unit}).
                  </p>
                ) : (
                  inlineError("quantity")
                )}
              </AdminField>
              <AdminField label="Reason">
                <AdminSelect
                  value={reason}
                  disabled={!hasItems || submitting}
                  onChange={(e) => {
                    setReason(e.target.value as StockAdjustReason | "");
                    setErrors((p) => ({ ...p, reason: null, note: null }));
                  }}
                >
                  <option value="">Select a reason…</option>
                  {ADJUST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </AdminSelect>
                {inlineError("reason")}
              </AdminField>
            </div>

            {direction === "add" && (
              <AdminField label="Expiry Date (optional)">
                <AdminInput
                  type="date"
                  value={expiryDate}
                  disabled={!hasItems || submitting}
                  onChange={(e) => {
                    setExpiryDate(e.target.value);
                    setErrors((p) => ({ ...p, expiryDate: null }));
                  }}
                />
                {inlineError("expiryDate")}
              </AdminField>
            )}

            <AdminField label={`Note${reason === "Other" ? " (required)" : " (optional)"}`}>
              <AdminTextarea
                placeholder={
                  reason === "Other"
                    ? "Describe what happened (required for “Other”)"
                    : `e.g. ${direction === "add" ? "found unopened stock in the back fridge" : "spilled during transfer to the condiment station"}`
                }
                value={note}
                disabled={!hasItems || submitting}
                onChange={(e) => {
                  setNote(e.target.value);
                  setErrors((p) => ({ ...p, note: null }));
                }}
                rows={2}
              />
              {inlineError("note")}
            </AdminField>

            <div className="flex justify-end pt-1">
              <AdminButton
                type="submit"
                disabled={
                  !hasItems || submitting || !itemId || !reason || (reason === "Other" && !note.trim())
                }
              >
                {submitting ? "Submitting…" : `Record ${direction === "add" ? "Increase" : "Decrease"}`}
              </AdminButton>
            </div>
          </form>
        </div>

        {/* ── Receipt panel (after successful write) ── */}
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#800000]" />
              <h2 className="font-bold text-stone-800">Last Adjustment</h2>
            </div>
          </div>
          {!receipt ? (
            <div className="p-8 text-center text-stone-400 font-bold text-sm">
              No adjustments recorded
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={receiptBadge.className}>{receiptBadge.label}</span>
                {receipt.reason && (
                  <span className="text-xs font-semibold text-stone-500 truncate">
                    — {receipt.reason}
                  </span>
                )}
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 divide-y divide-stone-200/70 text-sm">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                    Change
                  </span>
                  <span
                    className={`font-bold ${
                      Number(receipt.quantityChange) > 0
                        ? "text-emerald-700"
                        : Number(receipt.quantityChange) < 0
                          ? "text-rose-600"
                          : "text-stone-600"
                    }`}
                  >
                    {signedQty(receipt.quantityChange)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                    Was
                  </span>
                  <span className="font-semibold text-stone-700">
                    {fmtQty(receipt.balanceBefore)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                    Balance After
                  </span>
                  <span className="font-black text-[#800000]">
                    {fmtQty(receipt.balanceAfter)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
