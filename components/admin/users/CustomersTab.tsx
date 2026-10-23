"use client";

/* User Management — Customers tab. Disable / Enable / Edit phone against
   /api/admin/users/customers/* and the existing /api/admin/customers/:id/phone
   endpoint. Open unpaid orders surface as a subtle amber chip. */

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Power, Users } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminButton, AdminPanel } from "@/components/admin/AdminForm";
import {
  customerAction,
  fetchCustomersPage,
  updateCustomerPhone,
} from "./api";
import { relativeLastLogin, shortDate } from "./format";
import { useUserList } from "./use-user-list";
import type { CustomerRow, UserListQuery } from "./types";
import {
  EmptyState,
  ErrorBanner,
  FlaggedChip,
  Pagination,
  RefreshButton,
  SearchInput,
  SortDirButton,
  StatusPill,
  TableSkeleton,
  ToolbarSelect,
  UnpaidOrdersChip,
} from "./ui";

const LIMIT = 20;

/* Same PH mobile validation the customer checkout and admin customers pages
   use: normalize spaces/dashes, then require 09 + 9 digits. */
function normalizePhoneInput(v: string) {
  return v.replace(/[\s-]/g, "").trim();
}
function isPhoneFormatValid(v: string) {
  return /^09\d{9}$/.test(normalizePhoneInput(v));
}

export default function CustomersTab() {
  const { confirm, confirmAction } = useConfirm();

  const [applied, setApplied] = useState({
    page: 1,
    search: "",
    status: "all",
    sort: "name",
    dir: "asc" as "asc" | "desc",
  });

  const query = useMemo<UserListQuery>(
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

  const { data, loading, error, refresh } = useUserList<CustomerRow>(
    fetchCustomersPage,
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

  /* ── Actions ────────────────────────────────────────────────────────── */

  async function handleDisable(row: CustomerRow) {
    const confirmed = await confirmAction({
      title: `Disable ${row.name}?`,
      message: "This blocks sign-in and revokes their active sessions immediately.",
      variant: "danger",
      confirmLabel: "Disable",
      workingLabel: "Disabling",
      action: async () => {
        const result = await customerAction(row.id, "disable");
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      toast.success(`${row.name} can no longer sign in.`);
      refresh();
    }
  }

  async function handleEnable(row: CustomerRow) {
    const confirmed = await confirmAction({
      title: `Enable ${row.name}?`,
      message: "They will regain access and can sign in again.",
      variant: "info",
      confirmLabel: "Enable",
      workingLabel: "Enabling",
      action: async () => {
        const result = await customerAction(row.id, "enable");
        return result.ok ? null : result.message;
      },
    });
    if (confirmed) {
      toast.success(`${row.name} can sign in again.`);
      refresh();
    }
  }

  /* ── Edit phone modal ───────────────────────────────────────────────── */

  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditPhone(row: CustomerRow) {
    setEditing(row);
    setPhone(row.phone ?? "");
    setPhoneError(null);
  }

  async function handleSavePhone() {
    if (!editing || saving) return;
    const clean = normalizePhoneInput(phone);
    if (!isPhoneFormatValid(clean)) {
      setPhoneError("Mobile number must be 11 digits starting with 09.");
      return;
    }
    setSaving(true);
    setPhoneError(null);
    const result = await updateCustomerPhone(editing.id, clean);
    setSaving(false);
    if (result.ok) {
      setEditing(null);
      toast.success(`Saved ${clean} for ${editing.name}.`);
      refresh();
    } else {
      // Keep the dialog open; the backend message is shown verbatim.
      setPhoneError(result.message);
    }
  }

  /* ── Render pieces ──────────────────────────────────────────────────── */

  const actionButtons = (row: CustomerRow, align: "right" | "left") => {
    const alignClass = align === "right" ? "justify-end" : "";
    const isActive = (row.status || "active").toLowerCase() === "active";
    if (!isActive) {
      // Disabled customers show Enable only. There is deliberately no delete.
      return (
        <div className={`flex ${alignClass}`}>
          <ActionButton
            tone="green"
            icon={<Power className="h-3.5 w-3.5" />}
            label="Enable"
            onClick={() => handleEnable(row)}
          />
        </div>
      );
    }
    return (
      <div className={`flex ${alignClass} gap-1.5`}>
        <ActionButton
          tone="muted"
          icon={<Pencil className="h-3.5 w-3.5" />}
          label="Edit number"
          onClick={() => openEditPhone(row)}
        />
        <ActionButton
          tone="red"
          icon={<Power className="h-3.5 w-3.5" />}
          label="Disable"
          onClick={() => handleDisable(row)}
        />
      </div>
    );
  };

  return (
    <AdminPanel
      title="Customer Accounts"
      subtitle={data ? `${total} customer account${total === 1 ? "" : "s"}` : undefined}
      action={<RefreshButton busy={loading} onClick={refresh} />}
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <SearchInput
            onCommit={(value) => update({ search: value })}
            placeholder="Search name, email, mobile…"
          />
          <ToolbarSelect
            value={applied.status}
            onChange={(value) => update({ status: value })}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </ToolbarSelect>
          <ToolbarSelect
            value={applied.sort}
            onChange={(value) => update({ sort: value })}
          >
            <option value="name">Sort: Name</option>
            <option value="createdAt">Sort: Date created</option>
            <option value="lastLoginAt">Sort: Last login</option>
          </ToolbarSelect>
          <SortDirButton
            dir={applied.dir}
            onToggle={() =>
              update({ dir: applied.dir === "asc" ? "desc" : "asc" })
            }
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && rows.length === 0 && <TableSkeleton rows={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No customers found"
          hint="Try a different search or clear the filters."
        />
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div
          className={`hidden md:block overflow-x-auto px-3 pb-2 ${
            loading ? "pointer-events-none opacity-60 transition-opacity" : ""
          }`}
        >
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-stone-500 border-b border-stone-200">
                <th className="rounded-tl-xl px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="rounded-tr-xl px-4 py-3 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors ${
                    i < 10 ? "animate-in fade-in duration-300" : ""
                  }`}
                  style={i < 10 ? { animationDelay: `${i * 24}ms` } : undefined}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#800000]">{row.name}</span>
                      <span className="text-xs text-stone-400">{row.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-stone-600">
                    {row.phone ? (
                      <span className="text-[#800000]">{row.phone}</span>
                    ) : (
                      <span className="text-stone-400 italic">None yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={row.status} />
                      {row.openFlag && <FlaggedChip />}
                      {typeof row.openUnpaidOrders === "number" &&
                        row.openUnpaidOrders > 0 && (
                          <UnpaidOrdersChip count={row.openUnpaidOrders} />
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 font-medium">
                    {relativeLastLogin(row.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 font-medium">
                    {shortDate(row.createdAt)}
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
              key={row.id}
              className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h4 className="font-semibold text-[#800000] leading-tight">
                    {row.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">{row.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <StatusPill status={row.status} />
                  {row.openFlag && <FlaggedChip />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-3">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">
                    Mobile
                  </p>
                  <p className="font-medium text-stone-700 text-xs">
                    {row.phone ? (
                      <span className="text-[#800000]">{row.phone}</span>
                    ) : (
                      <span className="text-stone-400 italic">None yet</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">
                    Last login
                  </p>
                  <p className="font-medium text-stone-700 text-xs">
                    {relativeLastLogin(row.lastLoginAt)}
                  </p>
                </div>
                <div className="col-span-2 pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {typeof row.openUnpaidOrders === "number" &&
                      row.openUnpaidOrders > 0 && (
                        <UnpaidOrdersChip count={row.openUnpaidOrders} />
                      )}
                    <span className="text-[10px] text-stone-400 font-medium">
                      Created {shortDate(row.createdAt)}
                    </span>
                  </div>
                  {actionButtons(row, "left")}
                </div>
              </div>
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

      {/* Edit phone modal */}
      <AdminModal
        open={!!editing}
        title={editing ? `Edit number — ${editing.name}` : "Edit number"}
        onClose={() => {
          if (!saving) setEditing(null);
        }}
        footer={
          <>
            <AdminButton
              variant="secondary"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSavePhone}>
              {saving ? "Saving…" : "Save Number"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Currently: <strong>{editing?.phone ?? "none saved"}</strong>. Changes
            are recorded in the activity log.
          </p>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Mobile number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              placeholder="0917XXXXXXX"
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000] transition ${
                phoneError ? "border-red-500 bg-red-50/40" : "border-stone-200"
              }`}
            />
            {phoneError && (
              <p className="text-[11px] text-red-600 font-semibold mt-1">
                {phoneError}
              </p>
            )}
          </div>
        </div>
      </AdminModal>
    </AdminPanel>
  );
}

/* Small text action button in the CrudActions style of the admin kit. */
function ActionButton({
  tone,
  icon,
  label,
  onClick,
}: {
  tone: "muted" | "red" | "green";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    muted: "text-accent hover:bg-accent-light",
    red: "text-red-600 hover:bg-red-50",
    green: "text-green-700 hover:bg-green-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${tones[tone]} focus:outline-none focus:ring-2 focus:ring-[#800000]/20`}
    >
      {icon}
      {label}
    </button>
  );
}
