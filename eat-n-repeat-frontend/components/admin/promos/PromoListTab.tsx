"use client";

/* Promo Codes — main admin tab. CRUD against /api/admin/promos/*. Backend
   messages stay VERBATIM everywhere: 409 "This code already exists" inside
   the form, 402 used-code edit locks + 409 used-code delete refusal inside
   the confirmation dialog. */

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pause, Play, Plus, Tag, Trash2, Pencil } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { AdminButton, AdminPanel } from "@/components/admin/AdminForm";
import {
  activatePromo,
  createPromo,
  deletePromo,
  fetchPromoPage,
  pausePromo,
  updatePromo,
  type ActionResult,
} from "./api";
import { discountSummary, shortDate, shortDateTime } from "./format";
import { usePromoList } from "./use-promo-list";
import type { PromoListQuery, PromoRow } from "./types";
import {
  AudienceChip,
  ChannelChip,
  EmptyState,
  ErrorBanner,
  Pagination,
  PromoStatusPill,
  RefreshButton,
  SearchInput,
  TableSkeleton,
  ToolbarSelect,
} from "./ui";
import { PromoForm, type PromoFormPayload } from "./PromoForm";

const LIMIT = 20;

type FormState =
  | { mode: "create" }
  | { mode: "edit"; row: PromoRow }
  | null;

/* Backend-ready JSON for POST/PUT. FIXED codes never carry a cap; empty
   optional numbers are omitted entirely (the backend validates strictly). */
function payloadFromForm(form: PromoFormPayload, editing: boolean) {
  const o: Record<string, unknown> = {
    type: form.type,
    value: Number(form.value),
    channel: form.channel,
    audience: form.audience,
  };
  if (!editing) o.code = form.code;
  // The used-code edit lock (409) is worth attempting only when something
  // actually changed; sending an identical value back is rejected otherwise.
  if (form.type === "PERCENT" && form.maxDiscount) o.max_discount = Number(form.maxDiscount);
  if (form.minOrder) o.min_order = Number(form.minOrder);
  // The backend requires a start on create; a blank input means "now".
  o.starts_at = form.startsAt
    ? new Date(form.startsAt).toISOString()
    : new Date().toISOString();
  o.ends_at = form.expiresAt ? new Date(form.expiresAt).toISOString() : null;
  if (form.totalLimit) o.total_limit = Number(form.totalLimit);
  else if (editing) o.total_limit = null;
  if (editing || form.oncePerCustomer) o.per_customer_limit_once = form.oncePerCustomer;
  return o;
}

export default function PromoListTab() {
  const { confirm, confirmAction } = useConfirm();

  const [applied, setApplied] = useState({
    page: 1,
    search: "",
    status: "all",
    sort: "updatedAt",
    dir: "desc" as "asc" | "desc",
  });

  const query = useMemo<PromoListQuery>(
    () => ({
      page: applied.page,
      limit: LIMIT,
      search: applied.search,
      status: applied.status,
      sort: applied.sort,
      dir: applied.dir,
    }),
    [applied],
  );

  const { data, loading, error, refresh } = usePromoList<PromoRow>(
    fetchPromoPage,
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

  /* ── Form state ── */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }
  function openEdit(row: PromoRow) {
    setEditing(row);
    setFormError(null);
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSubmit(form: PromoFormPayload) {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    const result: ActionResult = editing
      ? await updatePromo(editing.id, payloadFromForm(form, true))
      : await createPromo(payloadFromForm(form, false));
    setSubmitting(false);
    if (!result.ok) {
      // Server text verbatim (duplicate code / used-code value lock…).
      setFormError(result.message);
      return;
    }
    closeForm();
    toast.success(
      result.message ??
        (editing ? "Promo updated." : `Promo ${form.code} created.`),
    );
    refresh();
  }

  /* ── Row actions ── */

  async function handlePause(row: PromoRow) {
    const confirmed = await confirmAction({
      title: `Pause ${row.code}?`,
      message:
        "Blocked immediately: new checkouts will see \"This code has been paused\" until the code is activated again.",
      variant: "warning",
      confirmLabel: "Pause",
      workingLabel: "Pausing",
      action: async () => {
        const result = await pausePromo(row.id);
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      toast.success(`${row.code} is paused.`);
      refresh();
    }
  }

  async function handleActivate(row: PromoRow) {
    const confirmed = await confirmAction({
      title: `Activate ${row.code}?`,
      message: "It becomes available for new checkouts under its current rules.",
      variant: "info",
      confirmLabel: "Activate",
      workingLabel: "Activating",
      action: async () => {
        const result = await activatePromo(row.id);
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      toast.success(`${row.code} is active.`);
      refresh();
    }
  }

  async function handleDelete(row: PromoRow) {
    const confirmed = await confirmAction({
      title: `Delete ${row.code}?`,
      message:
        "This removes the code permanently. Codes that have been redeemed at least once can't be deleted — pause those instead.",
      variant: "danger",
      confirmLabel: "Delete",
      workingLabel: "Deleting",
      action: async () => {
        const result = await deletePromo(row.id);
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      toast.success(`${row.code} deleted.`);
      refresh();
    }
  }

  /* ── Render ── */

  const actionButtons = (row: PromoRow, align: "right" | "left") => {
    const alignClass = align === "right" ? "justify-end" : "";
    const paused = (row.status || "").toUpperCase() === "PAUSED";
    return (
      <div className={`flex ${alignClass} gap-1 flex-wrap`}>
        <RawAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" tone="text-accent hover:bg-accent-light" onClick={() => openEdit(row)} />
        {paused ? (
          <RawAction
            icon={<Play className="h-3.5 w-3.5" />}
            label="Activate"
            tone="text-green-700 hover:bg-green-50"
            onClick={() => handleActivate(row)}
          />
        ) : (
          <RawAction
            icon={<Pause className="h-3.5 w-3.5" />}
            label="Pause"
            tone="text-amber-700 hover:bg-amber-50"
            onClick={() => handlePause(row)}
          />
        )}
        <RawAction
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label="Delete"
          tone="text-red-600 hover:bg-red-50"
          onClick={() => handleDelete(row)}
        />
      </div>
    );
  };

  return (
    <AdminPanel
      title="Promo Codes"
      subtitle={
        data ? `${total} code${total === 1 ? "" : "s"}` : undefined
      }
      action={
        <div className="flex items-center gap-2">
          <RefreshButton busy={loading} onClick={refresh} />
          <AdminButton onClick={openCreate}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              New code
            </span>
          </AdminButton>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <SearchInput
            onCommit={(value) => update({ search: value })}
            placeholder="Search code…"
          />
          <ToolbarSelect
            value={applied.status}
            onChange={(value) => update({ status: value })}
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="EXPIRED">Expired</option>
            <option value="USED_UP">Used up</option>
          </ToolbarSelect>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && rows.length === 0 && <TableSkeleton rows={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<Tag className="h-5 w-5" />}
          title={applied.search ? "No promos found" : "No promo codes yet"}
          hint={
            applied.search
              ? "Try a different search or clear the filters."
              : "Create your first discount code to get started."
          }
        />
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div
          className={`hidden md:block overflow-x-auto px-3 pb-2 ${
            loading ? "pointer-events-none opacity-60 transition-opacity" : ""
          }`}
        >
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-stone-500 border-b border-stone-200">
                <th className="rounded-tl-xl px-4 py-3 font-medium">Promo</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="rounded-tr-xl px-4 py-3 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.code}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors ${
                    i < 10 ? "animate-in fade-in duration-300" : ""
                  }`}
                  style={i < 10 ? { animationDelay: `${i * 24}ms` } : undefined}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono font-bold text-[#800000] text-sm">
                        {row.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <ChannelChip channel={row.channel} />
                        <AudienceChip audience={row.audience} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-stone-700">
                      {discountSummary(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PromoStatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-stone-600">
                    {Number(row.total_discounted ?? 0) > 0
                      ? `₱${Number(row.total_discounted).toFixed(2)} discounted · ${row.usage_count} redeem${row.usage_count === 1 ? "" : "s"}${row.total_limit ? ` of ${row.total_limit}` : ""}`
                      : "Not used yet"}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 font-medium">
                    {row.ends_at
                      ? `Ends ${shortDate(row.ends_at)}`
                      : new Date(row.starts_at) > new Date()
                        ? `Starts ${shortDate(row.starts_at)}`
                        : "No schedule"}
                  </td>
                  <td className="px-4 py-3 text-right">{actionButtons(row, "right")}</td>
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
              key={row.code}
              className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h4 className="font-mono font-bold text-[#800000] leading-tight truncate">
                    {row.code}
                  </h4>
                  <p className="text-xs font-semibold text-stone-600 mt-0.5">
                    {discountSummary(row)}
                  </p>
                </div>
                <PromoStatusPill status={row.status} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <ChannelChip channel={row.channel} />
                <AudienceChip audience={row.audience} />
              </div>

              <div className="mt-3 pt-2 border-t border-stone-100 space-y-1">
                <p className="text-[10px] text-stone-400 font-medium">
                  {Number(row.total_discounted ?? 0) > 0
                    ? `₱${Number(row.total_discounted).toFixed(2)} discounted · ${row.usage_count} redeem${row.usage_count === 1 ? "" : "s"}${row.total_limit ? ` of ${row.total_limit}` : ""}`
                    : "Not used yet"}
                  {row.updated_at
                    ? ` · Updated ${shortDateTime(row.updated_at)}`
                    : ""}
                </p>
              </div>

              <div className="mt-3">{actionButtons(row, "left")}</div>
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

      {/* Create / edit modal */}
      <PromoForm
        open={formOpen}
        editing={editing}
        submitting={submitting}
        error={formError}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
    </AdminPanel>
  );
}

/* Inline row-action button (text-only, CrudActions styling). */
function RawAction({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#800000]/20 ${tone}`}
    >
      {icon}
      {label}
    </button>
  );
}
