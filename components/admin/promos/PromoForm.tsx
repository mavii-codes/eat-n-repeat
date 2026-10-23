"use client";

/* Promo Codes — create / edit form on the admin kit (AdminModal + AdminForm
   primitives). Server messages (409 duplicate code, 402 used-code value/type
   lock, validation errors) land VERBATIM inside the form; the UI never
   paraphrases them. */

import { useEffect, useState } from "react";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminSelect,
} from "@/components/admin/AdminForm";
import type { PromoRow } from "./types";

export type PromoFormPayload = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;        // raw number string
  maxDiscount: string;  // raw number string ("" = none)
  minOrder: string;     // raw number string ("" = none)
  startsAt: string;     // datetime-local input value ("" = start now)
  expiresAt: string;    // datetime-local input value ("" = no end)
  totalLimit: string;   // raw integer string ("" = unlimited)
  oncePerCustomer: boolean;
  channel: "ONLINE" | "POS" | "BOTH";
  audience: "EVERYONE" | "LOGGED_IN";
};

type PromoFormProps = {
  open: boolean;
  /** Editing mode prefills and locks the code; create mode starts blank. */
  editing: PromoRow | null;
  submitting: boolean;
  error: string | null; // server message, verbatim
  onSubmit: (payload: PromoFormPayload) => void;
  onClose: () => void;
};

const CHANNEL_OPTIONS: { value: PromoFormPayload["channel"]; label: string }[] = [
  { value: "BOTH", label: "Online & POS" },
  { value: "ONLINE", label: "Online only" },
  { value: "POS", label: "POS only" },
];

const AUDIENCE_OPTIONS: { value: PromoFormPayload["audience"]; label: string }[] = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "LOGGED_IN", label: "Logged-in only" },
];

/* ISO → datetime-local input value (minute precision, local time). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function PromoForm({
  open,
  editing,
  submitting,
  error,
  onSubmit,
  onClose,
}: PromoFormProps) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [totalLimit, setTotalLimit] = useState("");
  const [oncePerCustomer, setOncePerCustomer] = useState(false);
  const [channel, setChannel] = useState<PromoFormPayload["channel"]>("BOTH");
  const [audience, setAudience] = useState<PromoFormPayload["audience"]>("EVERYONE");
  const [clientError, setClientError] = useState<string | null>(null);

  /* Prefill when the modal opens (fresh each time, no stale fields). */
  useEffect(() => {
    if (!open) return;
    setClientError(null);
    if (editing) {
      setCode(editing.code);
      setType((editing.type || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT");
      setValue(editing.value ?? "");
      setMaxDiscount(editing.max_discount ?? "");
      setMinOrder(editing.min_order ?? "");
      setStartsAt(toLocalInput(editing.starts_at));
      setExpiresAt(toLocalInput(editing.ends_at));
      setTotalLimit(editing.total_limit != null ? String(editing.total_limit) : "");
      setOncePerCustomer(Boolean(editing.per_customer_limit_once));
      setChannel(((editing.channel || "BOTH").toUpperCase()) as PromoFormPayload["channel"]);
      setAudience(((editing.audience || "EVERYONE").toUpperCase()) as PromoFormPayload["audience"]);
    } else {
      setCode("");
      setType("PERCENT");
      setValue("");
      setMaxDiscount("");
      setMinOrder("");
      setStartsAt("");
      setExpiresAt("");
      setTotalLimit("");
      setOncePerCustomer(false);
      setChannel("BOTH");
      setAudience("EVERYONE");
    }
  }, [open, editing]);

  if (!open) return null;

  function handleSubmit() {
    setClientError(null);
    const trimmedCode = code.trim().toUpperCase();
    if (!editing) {
      if (!/^[A-Za-z0-9]{2,12}$/.test(trimmedCode)) {
        setClientError("Codes are 2–12 letters or digits, with no spaces.");
        return;
      }
    }
    const num = Number(value);
    if (!value.trim() || !Number.isFinite(num) || num <= 0) {
      setClientError("Discount value must be greater than ₱0 (or 0%).");
      return;
    }
    if (type === "PERCENT" && num > 100) {
      setClientError("A percentage discount can't exceed 100.");
      return;
    }
    const maxNum = Number(maxDiscount);
    if (type === "PERCENT" && maxDiscount.trim()) {
      if (!Number.isFinite(maxNum) || maxNum <= 0) {
        setClientError("The discount cap must be greater than ₱0.00.");
        return;
      }
    }
	const minNum = Number(minOrder);
    if (minOrder.trim() && (!Number.isFinite(minNum) || minNum < 0)) {
      setClientError("Minimum order can't be negative.");
      return;
    }
    if (totalLimit.trim()) {
      const lim = Number(totalLimit);
      if (!Number.isInteger(lim) || lim < 1) {
        setClientError("Total limit must be a whole number of 1 or more.");
        return;
      }
    }
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      setClientError("The end date must be after the start date.");
      return;
    }
    onSubmit({
      code: trimmedCode,
      type,
      value: value.trim(),
      maxDiscount: type === "PERCENT" ? maxDiscount.trim() : "",
      minOrder: minOrder.trim(),
      startsAt,
      expiresAt,
      totalLimit: totalLimit.trim(),
      oncePerCustomer,
      channel,
      audience,
    });
  }

  const field =
    "w-full rounded-xl border border-accent/15 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <AdminModal
      open
      title={editing ? `Edit ${editing.code}` : "New promo code"}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <AdminButton variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton disabled={submitting} onClick={handleSubmit}>
            {submitting
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create promo"}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label="Code">
            <input
              className={field}
              value={code}
              disabled={!!editing}
              maxLength={12}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SAVE10"
            />
            {editing && (
              <span className="mt-1 block text-xs text-muted">
                Codes can't be renamed once created.
              </span>
            )}
          </AdminField>
          <AdminField label="Type">
            <AdminSelect
              value={type}
              onChange={(e) => setType(e.target.value === "FIXED" ? "FIXED" : "PERCENT")}
            >
              <option value="PERCENT">Percentage (% off)</option>
              <option value="FIXED">Fixed amount (₱ off)</option>
            </AdminSelect>
          </AdminField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label={type === "PERCENT" ? "Percent off" : "Amount off (₱)"}>
            <AdminInput
              type="number"
              min={0}
              step={type === "PERCENT" ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "PERCENT" ? "10" : "25"}
            />
          </AdminField>
          {type === "PERCENT" && (
            <AdminField label="Max discount (₱) — optional">
              <AdminInput
                type="number"
                min={0}
                step={0.01}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="50"
              />
            </AdminField>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label="Minimum order (₱) — optional">
            <AdminInput
              type="number"
              min={0}
              step={0.01}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="200"
            />
          </AdminField>
          <AdminField label="Channel">
            <AdminSelect
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as PromoFormPayload["channel"])
              }
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label="Total limit (uses) — optional">
            <AdminInput
              type="number"
              min={1}
              step={1}
              value={totalLimit}
              onChange={(e) => setTotalLimit(e.target.value)}
              placeholder="Unlimited"
            />
            <span className="mt-1 block text-xs text-muted">
              The code stops working the moment it's used up.
            </span>
          </AdminField>
          <AdminField label="Per-customer limit">
            <label className="flex items-center gap-2.5 rounded-xl border border-accent/15 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={oncePerCustomer}
                onChange={(e) => setOncePerCustomer(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 accent-[#800000]"
              />
              <span className="text-sm font-medium text-ink">
                Once per customer
              </span>
            </label>
          </AdminField>
        </div>

        <AdminField label="Audience">
          <AdminSelect
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as PromoFormPayload["audience"])
            }
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AdminSelect>
          {audience === "LOGGED_IN" && (
            <span className="mt-1 block text-xs text-muted">
              Walk-in POS customers can't use logged-in-only codes.
            </span>
          )}
        </AdminField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label="Starts at">
            <AdminInput
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              Leave blank to start the code immediately.
            </span>
          </AdminField>
          <AdminField label="Expires at — optional">
            <AdminInput
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </AdminField>
        </div>

        {(clientError || error) && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {clientError ?? error}
          </p>
        )}
      </div>
    </AdminModal>
  );
}
