"use client";

/* Flag customer — the staff/head_staff/admin report entry point for
   POST /api/admin/users/customers/:id/report { reason }.

   Visible-only capability: this module ADDS no admin-only behavior. It
   ships three small pieces so any orders view can opt in:

   - flagCustomerIdOf(order) — reads the ordering customer's id off a row;
     null for walk-ins and device-only offline rows (nothing to flag).
   - FlagCustomerLink — the quiet inline "Flag customer" trigger.
   - FlagCustomerModal — the reason dialog (AdminModal). Validation 5-500
     chars inline; backend messages (409 "This customer already has an open
     flag.", 400 reason message, 404 "Customer not found." for disabled
     accounts) surface VERBATIM and keep the dialog open. */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Flag } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminButton } from "@/components/admin/AdminForm";
import { reportCustomer } from "./api";
import { notifyFlagsChanged } from "./use-open-flag-count";
import type { FlagCustomerTarget } from "./types";

export type { FlagCustomerTarget } from "./types";

const REASON_MIN = 5;
const REASON_MAX = 500;

/** The ordering customer's id on an order row, or null when absent. */
export function flagCustomerIdOf(order: unknown): string | null {
  const id = (order as { customerId?: unknown } | null)?.customerId;
  if (typeof id === "string") {
    const trimmed = id.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

/** Quiet inline trigger, sized like the existing "Chat with Customer" link. */
export function FlagCustomerLink({
  onOpen,
  className = "text-[11px]",
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`inline-flex cursor-pointer items-center gap-1 font-semibold text-stone-400 transition-colors hover:text-[#800000] focus:outline-none focus-visible:text-[#800000] ${className}`}
    >
      <Flag className="h-3 w-3 shrink-0" aria-hidden />
      Flag customer
    </button>
  );
}

export function FlagCustomerModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: FlagCustomerTarget | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh dialog every time it opens (or a different customer is targeted).
  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setSaving(false);
    }
  }, [open, target?.customerId]);

  const guardClose = () => {
    if (!saving) onClose();
  };

  async function handleSubmit() {
    if (!target || saving) return;
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setError(
        `Reason must be ${REASON_MIN} to ${REASON_MAX} characters.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    const result = await reportCustomer(target.customerId, trimmed);
    setSaving(false);
    if (result.ok) {
      // The backend's own message fills the toast; fall back to the contract
      // string when it ships without one.
      toast.success(result.message || "Customer flagged for review.");
      notifyFlagsChanged();
      onClose();
    } else {
      // 409 / 400 / 404 messages stay verbatim; the dialog stays open.
      setError(result.message);
    }
  }

  return (
    <AdminModal
      open={open}
      title={
        target ? `Flag customer — ${target.customerName}` : "Flag customer"
      }
      onClose={guardClose}
      footer={
        <>
          <AdminButton variant="secondary" disabled={saving} onClick={guardClose}>
            Cancel
          </AdminButton>
          <AdminButton onClick={handleSubmit} disabled={saving}>
            {saving ? "Flagging…" : "Flag customer"}
          </AdminButton>
        </>
      }
    >
      {target && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-stone-800">{target.customerName}</p>
            {target.phone ? (
              <p className="mt-0.5 text-xs font-medium text-stone-500">{target.phone}</p>
            ) : null}
            {target.orderNumber ? (
              <p className="mt-0.5 text-xs text-stone-400">
                Order {target.orderNumber}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="flag-customer-reason"
              className="block text-xs font-bold uppercase tracking-wider text-stone-500"
            >
              Reason
            </label>
            <textarea
              id="flag-customer-reason"
              value={reason}
              rows={4}
              maxLength={REASON_MAX}
              placeholder="Describe what happened with this customer…"
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              className={`mt-1.5 w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-stone-800 transition focus:outline-none focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000] ${
                error ? "border-red-500 bg-red-50/40" : "border-stone-200"
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold text-stone-500">
                Shared with administrators only.
              </p>
              <p
                className={`shrink-0 text-[11px] font-semibold ${
                  reason.trim().length < REASON_MIN
                    ? "text-stone-400"
                    : "text-stone-500"
                }`}
              >
                {reason.trim().length}/{REASON_MAX}
              </p>
            </div>
            {error && (
              <p className="mt-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-[11px] font-bold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </AdminModal>
  );
}
