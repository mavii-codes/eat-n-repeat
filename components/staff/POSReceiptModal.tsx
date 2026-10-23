"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import { formatPhDateTime } from "@/lib/admin/delivery-utils";
import type { POSReceipt } from "@/components/staff/pos-receipt-types";

/* ──────────────────────────────────────────────
   Props
   ────────────────────────────────────────────── */

/** Dialog modes:
 *  "receipt" — post-checkout confirmation (closes → clears cart → Current Order)
 *  "details" — reopened from Paid Today (closes → back to Paid Today, no cart changes)
 */
export type POSReceiptDialogMode = "receipt" | "details";

export type POSReceiptModalProps = {
  open: boolean;
  /** Populated ONLY from the checkout response (or a Paid Today row). */
  receipt: POSReceipt | null;
  mode: POSReceiptDialogMode;
  onClose: () => void;
};

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function php(value: unknown): string {
  const n = Number(value);
  return `₱${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export function POSReceiptModal({
  open,
  receipt,
  mode,
  onClose,
}: POSReceiptModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the dialog + Escape-to-close (listener cleaned up on close).
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !receipt) return null;

  const isDetails = mode === "details";
  const createdAt = receipt.createdAt ? formatPhDateTime(receipt.createdAt) : "—";
  const cashier = receipt.cashier || "—";
  const orderType = receipt.orderType || "—";
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const subtotal = Number(receipt.subtotal) || 0;
  const tax = Number(receipt.tax) || 0;
  const deliveryFee = Number(receipt.deliveryFee) || 0;
  const total = Number(receipt.total) || 0;
  // Promo snapshot (older offline rows may omit the fields entirely).
  const promoCode = receipt.promoCode ?? null;
  const discount = Number(receipt.discount) || 0;
  const change = receipt.change;
  const changeBreakdown =
    receipt.changeBreakdown && receipt.changeBreakdown.trim()
      ? receipt.changeBreakdown
      : null;
  const showBreakdown = changeBreakdown !== null && (change ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isDetails ? "Sale details" : "Sale confirmation"}
        className="relative z-10 w-full max-w-md my-auto flex flex-col outline-none"
      >
        {/* Close (X) — Escape and backdrop use the same onClose */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute -top-2.5 -right-2.5 z-20 w-8 h-8 rounded-full bg-stone-900 text-white shadow-lg flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="rounded-2xl border border-stone-200 shadow-2xl overflow-hidden bg-white">
          {/* ── Title bar: "Sale Confirmed" ── */}
          <div className="bg-gradient-to-r from-[#63131d] via-[#63131d] to-[#4a0e16] px-5 py-4 flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
            <h2 className="font-serif text-xl font-black text-white tracking-tight">
              Sale Confirmed
            </h2>
          </div>

          {/* ── Receipt content ── */}
          <div className="max-h-[62vh] overflow-y-auto">
            <div className="p-5 font-mono text-[11px] leading-relaxed text-stone-800">
              {/* Café header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-300">
                <h3 className="font-serif font-black text-lg text-[#63131d]">
                  Eat n&apos; RepEat Café
                </h3>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Near Aby Road, Poblacion, Cordova, Cebu
                </p>
              </div>

              {/* Order meta */}
              <div className="space-y-1 py-3 border-b border-dashed border-stone-300">
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500">Order No.:</span>
                  <span className="font-bold text-[#63131d] truncate">
                    #{receipt.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500">Date &amp; Time:</span>
                  <span className="font-semibold text-right">{createdAt}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500">Cashier:</span>
                  <span className="font-semibold text-right truncate">{cashier}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500">Order Type:</span>
                  <span className="font-semibold text-right">{orderType}</span>
                </div>
              </div>

              {/* Items — qty × name, line totals, add-ons, notes */}
              <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
                <div className="flex justify-between font-black text-[9px] text-stone-400 uppercase tracking-wider">
                  <span>Item</span>
                  <span>Amount</span>
                </div>
                {items.length === 0 && (
                  <p className="text-stone-400 italic">No item lines.</p>
                )}
                {items.map((item, idx) => {
                  const qty = Number(item.quantity) || 0;
                  const unit = Number(item.unitPrice) || 0;
                  const line =
                    Number(item.lineTotal) || Number((qty * unit).toFixed(2));
                  const isAddon = item.isAddon === true;
                  return (
                    <div
                      key={`${item.name}-${idx}`}
                      className={`space-y-0.5 ${isAddon ? "pl-3 border-l-2 border-stone-200" : ""}`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold min-w-0 truncate pr-1">
                          {isAddon && <span className="text-stone-400">+ </span>}
                          <span className="font-bold">{qty}× </span>
                          {item.name}
                          {isAddon && (
                            <span className="ml-1 text-[8px] font-black uppercase tracking-wider text-amber-600">
                              Add-on
                            </span>
                          )}
                        </span>
                        <span className="font-bold shrink-0">{php(line)}</span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {php(unit)} each
                      </div>
                      {item.notes && item.notes.trim().length > 0 && (
                        <div className="text-[10px] italic text-amber-700">
                          Note: {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Totals + payment */}
              <div className="py-3 space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>{php(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Tax</span>
                    <span>{php(tax)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Delivery Fee</span>
                    <span>{php(deliveryFee)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>
                      Discount{promoCode ? ` · ${promoCode}` : ""}
                    </span>
                    <span>-{php(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-stone-300 font-black text-sm text-[#63131d]">
                  <span>TOTAL</span>
                  <span className="text-base">{php(total)}</span>
                </div>
                <div className="flex justify-between text-stone-600 pt-2">
                  <span>Payment Method:</span>
                  <span className="font-bold text-emerald-700">
                    {receipt.paymentMethod || "—"}
                  </span>
                </div>
                {receipt.cashTendered !== null && receipt.cashTendered !== undefined && (
                  <div className="flex justify-between text-stone-600">
                    <span>Cash Tendered:</span>
                    <span className="font-semibold">{php(receipt.cashTendered)}</span>
                  </div>
                )}
                {change !== null && change !== undefined && (
                  <div className="mt-2.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      Change Due
                    </span>
                    <span className="text-base font-black text-emerald-800">
                      {php(change)}
                    </span>
                  </div>
                )}
                {showBreakdown && (
                  <div className="pt-2 flex flex-wrap gap-1 justify-center">
                    {changeBreakdown!.split(",").map((piece, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[9px] font-semibold text-stone-600"
                      >
                        {piece.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="text-center pt-3 border-t border-dashed border-stone-300">
                <p className="font-bold text-[#63131d]">Thank you for dining with us!</p>
                <p className="text-[9px] text-stone-400 mt-0.5">
                  Eat n&apos; RepEat Café — Cordova, Cebu
                </p>
              </div>
            </div>
          </div>

          {/* ── Single action ── */}
          <div className="border-t border-stone-100 bg-stone-50/60 p-4">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer ${
                isDetails
                  ? "bg-stone-900 hover:bg-black text-white shadow-md"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              }`}
            >
              {isDetails ? "Close" : "Done / New Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
