"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { History, PackagePlus } from "lucide-react";
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
import type { StockMovementPage } from "@/lib/admin/types";
import {
  fmtQty,
  formatLayerDate,
  formatMovementDateTime,
  getExpiryStatus,
  getManilaDateString,
  movementTotalCost,
  peso,
  phLocalInputToIso,
  phNowLocalInput,
} from "@/lib/admin/inventory-utils";

/* ══════════════════════════════════════════════════════════════
   Stock In (A2) — receive stock with unit cost.
   POST /api/stock/items/:id/stock-in via stockInItem(); on-hand
   resync happens inside the context helper (refreshBackendStock).
   ══════════════════════════════════════════════════════════════ */

const CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const CARD_HEAD = "p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50";

export default function StockInPage() {
  const { stockItems, stockInItem, fetchStockMovementsPage } = useAdminData();

  const sortedItems = useMemo(
    () => [...stockItems].sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems],
  );

  const [itemId, setItemId] = useState("");
  // Default to "now" as Asia/Manila wall time; set on mount (client-only)
  // so SSR and hydration agree.
  const [receivedAt, setReceivedAt] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  // Default the received date AFTER hydration (server clock ≠ device clock).
  useEffect(() => {
    setReceivedAt(phNowLocalInput());
  }, []);

  const selected = useMemo(
    () => sortedItems.find((i) => i.id === itemId) ?? null,
    [sortedItems, itemId],
  );

  const hasItems = sortedItems.length > 0;
  // Client-side guard: expiry must be on/after the received DATE.
  const expiryInvalid =
    expiryDate !== "" &&
    receivedAt !== "" &&
    expiryDate < receivedAt.slice(0, 10);

  // ── Recent Stock Ins ──
  // Same ledger API the history page uses, locked to STOCK_IN rows:
  // page 1, 10 newest first (the movements endpoint returns them newest
  // first). Own loading / failed (retry) / empty states; a successful
  // submit refreshes it below so the new entry appears immediately.
  const [recentIns, setRecentIns] = useState<StockMovementPage | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentFailed, setRecentFailed] = useState(false);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    const res = await fetchStockMovementsPage({ type: "STOCK_IN", page: 1, limit: 10 });
    if (res) {
      setRecentIns(res);
      setRecentFailed(false);
    } else {
      setRecentFailed(true);
    }
    setRecentLoading(false);
  }, [fetchStockMovementsPage]);

  useEffect(() => {
    // Deferred by a timer tick (the same pattern the history page's debounced
    // loader uses) so the fetch fires on mount without a sync cascading render.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void loadRecent();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadRecent]);

  const recentMovements = recentIns?.movements ?? [];

  const validate = useCallback((): Record<string, string> | null => {
    const next: Record<string, string> = {};
    if (!hasItems) next.itemId = "Create a stock item first.";
    if (!itemId) next.itemId = "Select an item.";
    const q = Number(quantity);
    if (!quantity.trim() || !Number.isFinite(q) || q <= 0) {
      next.quantity = "Quantity must be greater than 0.";
    } else if (Math.abs(q * 100 - Math.round(q * 100)) >= 1e-6) {
      next.quantity = "Quantity can have at most 2 decimal places.";
    }
    const c = Number(unitCost);
    if (unitCost.trim() === "" || !Number.isFinite(c) || c < 0) {
      next.unitCost = "Unit cost is required (0 or more).";
    } else if (Math.abs(c * 100 - Math.round(c * 100)) >= 1e-6) {
      next.unitCost = "Unit cost can have at most 2 decimal places.";
    }
    if (!receivedAt) {
      next.receivedAt = "Received date is required.";
    } else {
      const recDate = new Date(receivedAt);
      if (Number.isNaN(recDate.getTime())) {
        next.receivedAt = "Invalid date and time.";
      } else if (recDate.getUTCFullYear() < 2020) {
        next.receivedAt = "Date received cannot be before 2020.";
      } else if (recDate.getTime() > Date.now() + 10 * 60 * 1000) {
        next.receivedAt = "Date received cannot be more than 10 minutes in the future.";
      }
    }
    if (expiryDate) {
      const recManilaDate = receivedAt ? receivedAt.slice(0, 10) : getManilaDateString();
      if (expiryDate < recManilaDate) {
        next.expiryDate = "Expiry date can't be before the date received";
      } else {
        const todayManila = getManilaDateString();
        if (expiryDate < todayManila && recManilaDate >= todayManila) {
          next.expiryDate = "Expiry date cannot be in the past unless date received is also in the past.";
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length > 0 ? next : null;
  }, [hasItems, itemId, quantity, unitCost, receivedAt, expiryDate]);

  const resetForm = useCallback(() => {
    setQuantity("");
    setUnitCost("");
    setExpiryDate("");
    setSupplier("");
    setNote("");
    setErrors({});
    setReceivedAt(phNowLocalInput());
  }, []);

  const submit = useCallback(async () => {
    if (validate()) return;
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const result = await stockInItem(selected.id, {
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        receivedAt: phLocalInputToIso(receivedAt) ?? undefined,
        expiryDate: expiryDate || undefined,
        supplier: supplier || undefined,
        note: note || undefined,
      });
      if (result.ok) {
        const unit =
          result.item?.unit && String(result.item.unit).trim()
            ? String(result.item.unit).trim()
            : selected.unit;
        const name = result.item?.name || selected.name;
        const newQty = result.item
          ? Number(result.item.quantity)
          : Number(result.movement?.balanceAfter ?? 0);
        toast.success(
          `Stocked in ${fmtQty(quantity)} ${unit} of ${name} — New balance: ${fmtQty(newQty)} ${unit}`,
          { duration: 8000 },
        );
        resetForm();
        // Show the new movement in the Recent Stock Ins table right away.
        void loadRecent();
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
          toast.error(result.message || "Stock-in failed. Try again.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, stockInItem, quantity, unitCost, receivedAt, expiryDate, supplier, note, validate, resetForm, loadRecent]);

  const inlineError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs font-semibold text-red-600">{errors[key]}</p> : null;

  return (
    <div className="space-y-6">
      <AdminBackLink />

      <AdminPageHeader
        title="Stock In"
        subtitle="Receive items with quantity and unit cost; every entry becomes a movement in the ledger."
        badge="Operations"
      />

      <div className={CARD}>
        <div className={CARD_HEAD}>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Receive Stock</h2>
          </div>
          {selected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-700 border border-stone-200">
              On hand: {fmtQty(selected.quantity)} {selected.unit}
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
          {!hasItems ? (
            <p className="text-sm text-stone-500 font-semibold">
              No stock items yet.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="grid grid-cols-2 gap-4">
              <AdminField label="Quantity">
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
                {inlineError("quantity")}
              </AdminField>
              <AdminField label="Unit Cost (₱) — required">
                <AdminInput
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={unitCost}
                  disabled={!hasItems || submitting}
                  onChange={(e) => {
                    setUnitCost(e.target.value);
                    setErrors((p) => ({ ...p, unitCost: null }));
                  }}
                />
                {inlineError("unitCost")}
              </AdminField>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Date Received (Asia/Manila)">
              <AdminInput
                type="datetime-local"
                value={receivedAt}
                disabled={!hasItems || submitting}
                onChange={(e) => {
                  setReceivedAt(e.target.value);
                  setErrors((p) => ({ ...p, receivedAt: null }));
                }}
              />
              {inlineError("receivedAt")}
            </AdminField>
            <AdminField label="Expiry Date (optional)">
              <AdminInput
                type="date"
                min={receivedAt ? receivedAt.slice(0, 10) : undefined}
                value={expiryDate}
                disabled={!hasItems || submitting}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  setErrors((p) => ({ ...p, expiryDate: null }));
                }}
              />
              {inlineError("expiryDate")}
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Supplier (optional)">
              <AdminInput
                type="text"
                placeholder="e.g. Santa Fe Dairy"
                value={supplier}
                disabled={!hasItems || submitting}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </AdminField>
            <AdminField label="Note (optional)">
              <AdminTextarea
                placeholder="e.g. Invoice #1842 — 2 crates delivered"
                value={note}
                disabled={!hasItems || submitting}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </AdminField>
          </div>

          <div className="flex justify-end pt-1">
            <AdminButton
              type="submit"
              disabled={!hasItems || submitting || !itemId || expiryInvalid}
            >
              {submitting ? "Submitting…" : "Record Stock In"}
            </AdminButton>
          </div>
        </form>
      </div>

      {/* ── Recent Stock Ins ── */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Recent Stock Ins</h2>
          </div>
          <Link
            href="/admin/inventory/history"
            className="text-xs font-bold text-[#800000] hover:underline underline-offset-2"
          >
            View all →
          </Link>
        </div>
        {recentLoading ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">
            Loading stock-ins…
          </div>
        ) : recentFailed ? (
          <div className="p-8 text-center text-stone-400 font-bold text-sm">
            Couldn&apos;t load recent stock-ins.{" "}
            <button
              type="button"
              onClick={() => void loadRecent()}
              className="font-bold text-[#800000] underline underline-offset-2 hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        ) : recentMovements.length === 0 ? (
          <div className="p-8 text-center text-stone-400 font-bold text-sm">
            No stock-ins yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Cost</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Expiry</th>
                  <th className="px-3 py-2.5">Supplier / Reference</th>
                  <th className="px-3 py-2.5">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentMovements.map((movement) => {
                  const total = movementTotalCost(movement);
                  const expiryStatus = getExpiryStatus(movement.expiryDate);
                  return (
                    <tr key={movement.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">
                        {formatMovementDateTime(movement.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-stone-900">
                        {movement.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-stone-700 whitespace-nowrap">
                        {fmtQty(movement.quantityChange)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {movement.unitCost != null ? (
                          peso(movement.unitCost)
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {total != null ? (
                          peso(total)
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {movement.expiryDate ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-stone-700">
                              {formatLayerDate(movement.expiryDate)}
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
                      <td className="px-3 py-2.5 text-stone-600 max-w-[180px] truncate">
                        {movement.reference || movement.reason || (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-stone-700 font-semibold whitespace-nowrap">
                        {movement.createdByName || <span className="text-stone-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
