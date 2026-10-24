"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Eye, Clock, ShieldCheck, PhilippinePeso, History, Flag, CheckCircle2, X, Loader2, Pencil } from "lucide-react";
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";
import { useAuth } from "@/context/AuthContext";
import type { CashShift, CashTransaction, ExpenseItem } from "@/lib/admin/types";
import {
  expenseCategoryChip,
  expenseSourceChip,
  expenseStatusChip,
  normalizeExpenses,
  shiftExpensesNet,
} from "@/lib/admin/expense-utils";

function getCashSales(s: CashShift) {
  if (s.cash_sales != null) {
    return Number(s.cash_sales);
  }
  const expected = Number(s.expected_cash || 0);
  const starting = Number(s.starting_float || 0);
  return Math.max(0, expected - starting);
}

const SORT_OPTIONS = [
  { value: "date:desc", label: "Date/Time (Newest first)" },
  { value: "date:asc", label: "Date/Time (Oldest first)" },
  { value: "staff:asc", label: "Staff (A-Z)" },
  { value: "staff:desc", label: "Staff (Z-A)" },
  { value: "variance:desc", label: "Variance (Highest first)" },
  { value: "variance:asc", label: "Variance (Lowest first)" },
  { value: "counted_cash:desc", label: "Counted Cash (Highest first)" },
  { value: "counted_cash:asc", label: "Counted Cash (Lowest first)" },
  { value: "expected_cash:desc", label: "Expected Cash (Highest first)" },
  { value: "expected_cash:asc", label: "Expected Cash (Lowest first)" },
  { value: "duration:desc", label: "Duration (Longest first)" },
  { value: "duration:asc", label: "Duration (Shortest first)" },
] as const;

const DEFAULT_SORT = "date:desc";

const FILTER_CONTROL_CLASS =
  "text-xs font-semibold text-stone-700 border border-stone-300 rounded-lg pl-2 pr-2 py-1.5 bg-white focus:ring-2 focus:ring-[#800000]/30 focus:border-[#800000] outline-none cursor-pointer";

export default function CashManagementPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<CashShift[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("eat-n-repeat-cached-cash-shifts");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState<string | null>(null);

  // Shift History filters + sorting (applied server-side via query params).
  const [staffFilter, setStaffFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [signoffFilter, setSignoffFilter] = useState("");
  const [sortKey, setSortKey] = useState<string>(DEFAULT_SORT);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);

  // Edit Audit Sign-off state
  const [editSignoffShift, setEditSignoffShift] = useState<CashShift | null>(null);
  const [editSignoffStatus, setEditSignoffStatus] = useState<string>("unverified");
  const [editSignoffReason, setEditSignoffReason] = useState("");
  const [editSignoffSaving, setEditSignoffSaving] = useState(false);
  const [showEditSignoffConfirm, setShowEditSignoffConfirm] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        setIsStale(true);
        setFetchError(
          user?.role === "admin"
            ? "Cloud session token is missing or expired. Sign in online to refresh live data."
            : "Authentication required. Please log in as Admin."
        );
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      if (staffFilter) params.set("staffId", staffFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusFilter) params.set("status", statusFilter);
      if (signoffFilter) params.set("signoff", signoffFilter);
      const [sortBy, sortDir] = sortKey.split(":");
      if (sortBy) params.set("sortBy", sortBy);
      if (sortDir) params.set("sortDir", sortDir);
      const res = await fetch(`${getApiUrl()}/api/cash/shifts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        setIsStale(true);
        setFetchError("Session unauthorized or expired. Please re-login.");
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setShifts(data.shifts);
        const isDefaultView =
          !staffFilter && !startDate && !endDate && !statusFilter && !signoffFilter;
        // Only the unfiltered view refreshes the offline cache, so the cache
        // is never replaced by a filtered subset.
        if (isDefaultView) {
          try {
            localStorage.setItem("eat-n-repeat-cached-cash-shifts", JSON.stringify(data.shifts));
          } catch {}
        }
        // Staff dropdown options come from unfiltered fetches and accumulate,
        // so the selected staff never disappears from the list.
        if (!staffFilter) {
          setStaffOptions((prev) => {
            const merged = new Map(prev.map((o) => [o.id, o.name]));
            for (const s of data.shifts as CashShift[]) {
              if (s.staff_id && s.staff_name && !merged.has(s.staff_id)) {
                merged.set(s.staff_id, s.staff_name);
              }
            }
            if (merged.size === prev.length) return prev;
            return Array.from(merged, ([id, name]) => ({ id, name })).sort((a, b) =>
              a.name.localeCompare(b.name)
            );
          });
        }
        setIsStale(false);
        setFetchError(null);
      } else {
        setIsStale(true);
        setFetchError(data?.message || "Failed to load shifts");
      }
    } catch (e) {
      console.warn("Failed to fetch shifts:", e);
      setIsStale(true);
    } finally {
      setLoading(false);
    }
  }, [user?.role, staffFilter, startDate, endDate, statusFilter, signoffFilter, sortKey]);

  const isDefaultView =
    !staffFilter && !startDate && !endDate && !statusFilter && !signoffFilter && sortKey === DEFAULT_SORT;

  const clearFilters = () => {
    setStaffFilter("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    setSignoffFilter("");
    setSortKey(DEFAULT_SORT);
  };

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted && document.visibilityState === "visible") {
        fetchShifts();
      }
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchShifts]);

  const confirmVerify = async (shiftId: string) => {
    setVerifyingId(shiftId);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        toast.error("Authentication required.");
        return;
      }
      const res = await fetch(`${getApiUrl()}/api/cash/shifts/${shiftId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success("Shift verified.");
        setShowVerifyModal(null);
        await fetchShifts();
      } else {
        toast.error(data?.message || "Failed to verify shift.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error.");
    } finally {
      setVerifyingId(null);
    }
  };

  const confirmFlag = async (shiftId: string) => {
    const trimmed = flagReason.trim();
    if (!trimmed) {
      toast.error("A flag reason is required.");
      return;
    }
    
    setFlaggingId(shiftId);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        toast.error("Authentication required.");
        return;
      }
      const res = await fetch(`${getApiUrl()}/api/cash/shifts/${shiftId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success("Shift flagged.");
        setShowFlagModal(null);
        setFlagReason("");
        await fetchShifts();
      } else {
        toast.error(data?.message || "Failed to flag shift.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error.");
    } finally {
      setFlaggingId(null);
    }
  };

  const openEditSignoff = (s: CashShift) => {
    const currentStatus = (s.verification_status || "unverified").toLowerCase();
    setEditSignoffShift(s);
    setEditSignoffStatus(currentStatus);
    setEditSignoffReason(currentStatus === "flagged" ? (s.flag_reason || "") : "");
    setEditSignoffSaving(false);
    setShowEditSignoffConfirm(false);
  };

  const handleEditSignoffSave = async () => {
    if (!editSignoffShift) return;
    if (editSignoffStatus === "flagged" && !editSignoffReason.trim()) {
      toast.error("A flag reason is required.");
      return;
    }
    setEditSignoffSaving(true);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        toast.error("Authentication required.");
        return;
      }
      const res = await fetch(`${getApiUrl()}/api/cash/shifts/${editSignoffShift.id}/audit-signoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: editSignoffStatus,
          reason: editSignoffStatus === "flagged" ? editSignoffReason.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success("Audit sign-off updated.");
        setEditSignoffShift(null);
        setShowEditSignoffConfirm(false);
        await fetchShifts();
      } else {
        toast.error(data?.message || "Failed to update audit sign-off.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error.");
    } finally {
      setEditSignoffSaving(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-200">Open Shift</span>;
      case 'closed': return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200">Closed</span>;
      case 'matched': return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200">Reconciled</span>;
      case 'short': return <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200">Shortage</span>;
      case 'over': return <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-200">Over</span>;
      default: return <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded border border-stone-200">{status}</span>;
    }
  };

  const getVerificationBadge = (s: CashShift) => {
    const v = (s.verification_status || "unverified").toLowerCase();
    if (v === "verified") {
      return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200">Verified</span>;
    }
    if (v === "flagged") {
      return <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200">Flagged</span>;
    }
    return <span className="px-2 py-1 bg-stone-100 text-stone-500 text-[10px] font-bold uppercase rounded border border-stone-200">Unverified</span>;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cash Management"
        subtitle="Monitor physical cash drawers, shifts, and reconciliations across your staff."
        badge="Finance"
      />

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Shift History</h2>
            {isStale ? (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Offline / Cached
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Live Data
              </span>
            )}
          </div>
          <button onClick={fetchShifts} className="text-xs font-bold text-stone-500 hover:text-stone-800">
            Refresh
          </button>
        </div>

        {/* Filter + sort bar — one compact row, wraps on narrow screens.
            All controls combine with AND and are applied server-side. */}
        <div className="px-4 py-3 border-b border-stone-100 bg-white flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by staff"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All Staff</option>
            {staffOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <label htmlFor="shift-filter-from" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              From
            </label>
            <input
              id="shift-filter-from"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className={FILTER_CONTROL_CLASS}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="shift-filter-to" className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              To
            </label>
            <input
              id="shift-filter-to"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={FILTER_CONTROL_CLASS}
            />
          </div>

          <select
            aria-label="Filter by shift status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All Statuses</option>
            <option value="open">Open Shift</option>
            <option value="matched">Reconciled</option>
          </select>

          <select
            aria-label="Filter by audit sign-off"
            value={signoffFilter}
            onChange={(e) => setSignoffFilter(e.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All Sign-offs</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            aria-label="Sort shifts"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={isDefaultView}
            className="text-xs font-bold text-stone-500 enabled:hover:text-[#800000] enabled:hover:underline underline-offset-2 disabled:opacity-40 disabled:cursor-default"
          >
            Clear Filters
          </button>
        </div>

        {fetchError && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <span>{fetchError}</span>
            <button
              onClick={fetchShifts}
              className="font-bold underline hover:text-amber-900 ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">
            {isDefaultView ? "No cash shifts found." : "No shifts match the applied filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-2.5 py-2.5">Staff</th>
                  <th className="px-2.5 py-2.5">Shift Time</th>
                  <th className="px-2.5 py-2.5">Opening Float</th>
                  <th className="px-2.5 py-2.5">Cash Sales</th>
                  <th className="px-2.5 py-2.5">Expected</th>
                  <th className="px-2.5 py-2.5">Expenses</th>
                  <th className="px-2.5 py-2.5">Counted Cash</th>
                  <th className="px-2.5 py-2.5">Variance</th>
                  <th className="px-2.5 py-2.5 text-center">Shift Status</th>
                  <th className="px-2.5 py-2.5 text-center">Audit Sign-off</th>
                  <th className="px-2.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-2.5 py-2.5 font-bold text-[#800000]">{s.staff_name}</td>
                    <td className="px-2.5 py-2.5 text-stone-600">
                      <div>{new Date(s.start_time).toLocaleString('en-PH', { month: 'short', day: 'numeric' })}</div>
                      <div className="text-[10px] text-stone-400">
                        {new Date(s.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        {s.end_time ? ` - ${new Date(s.end_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : " - Present"}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 font-medium">₱{parseFloat(s.starting_float as string).toFixed(2)}</td>
                    <td className="px-2.5 py-2.5 font-medium text-emerald-700">₱{getCashSales(s).toFixed(2)}</td>
                    <td className="px-2.5 py-2.5 font-medium">₱{parseFloat(s.expected_cash as string).toFixed(2)}</td>
                    <td className="px-2.5 py-2.5 font-medium text-amber-700">
                      {Array.isArray(s.expenses) ? "₱0.00" : `₱${(Number(s.expenses) || 0).toFixed(2)}`}
                    </td>
                    <td className="px-2.5 py-2.5 font-bold text-stone-900">{s.actual_cash ? `₱${parseFloat(s.actual_cash as string).toFixed(2)}` : "-"}</td>
                    <td className="px-2.5 py-2.5 font-bold">
                      {s.difference != null ? (
                        <span className={parseFloat(s.difference as string) < 0 ? "text-rose-600" : parseFloat(s.difference as string) > 0 ? "text-blue-600" : "text-emerald-600"}>
                          {parseFloat(s.difference as string) === 0 ? "₱0.00" : parseFloat(s.difference as string) > 0 ? `+₱${parseFloat(s.difference as string).toFixed(2)}` : `-₱${Math.abs(parseFloat(s.difference as string)).toFixed(2)}`}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-2.5 py-2.5 text-center">{getStatusBadge(s.status)}</td>
                    <td className="px-2.5 py-2.5 text-center">{getVerificationBadge(s)}</td>
                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      {(() => {
                        const vStatus = (s.verification_status || 'unverified').toLowerCase();
                        if (s.status === 'open') return null;
                        if (vStatus === 'unverified') {
                          return (
                            <>
                              <button
                                onClick={() => setShowVerifyModal(s.id)}
                                disabled={verifyingId === s.id || flaggingId === s.id}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg shadow-sm mr-1"
                                title="Verify shift"
                                aria-label="Verify shift"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setShowFlagModal(s.id);
                                  setFlagReason("");
                                }}
                                disabled={verifyingId === s.id || flaggingId === s.id}
                                className="p-1.5 bg-white border border-rose-300 hover:bg-rose-50 disabled:opacity-50 text-rose-700 rounded-lg shadow-sm mr-1"
                                title="Flag shift"
                                aria-label="Flag shift"
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            </>
                          );
                        }
                        // verified or flagged — show Edit Sign-off
                        return (
                          <button
                            onClick={() => openEditSignoff(s)}
                            className="p-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg shadow-sm mr-1 inline-flex items-center"
                            title="Edit audit sign-off"
                            aria-label="Edit audit sign-off"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                      <button onClick={() => setSelectedShiftId(s.id)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 text-[#800000] shadow-sm" title="View details" aria-label="View shift details">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verify Shift In-App Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Verify Shift</h3>
            <p className="text-sm text-stone-600 mb-6">
              Are you sure you want to verify this shift?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowVerifyModal(null)}
                disabled={verifyingId !== null}
                className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmVerify(showVerifyModal)}
                disabled={verifyingId !== null}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {verifyingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {verifyingId ? "Verifying..." : "Verify Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Shift In-App Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Flag Shift</h3>
            <div className="mb-6">
              <label className="block text-xs font-bold text-stone-700 mb-2">Reason:</label>
              <textarea
                rows={3}
                required
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Reason for flagging this shift..."
                className="w-full text-sm border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-[#800000] focus:border-[#800000] outline-none resize-none"
                disabled={flaggingId !== null}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowFlagModal(null); setFlagReason(""); }}
                disabled={flaggingId !== null}
                className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmFlag(showFlagModal)}
                disabled={flaggingId !== null || !flagReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {flaggingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {flaggingId ? "Flag Shift" : "Flag Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Audit Sign-off Modal */}
      {editSignoffShift && !showEditSignoffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Edit Audit Sign-off</h3>

            <div className="mb-4">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Current Status</label>
              <span className={`inline-block px-2.5 py-1 text-[11px] font-bold uppercase rounded border ${
                (editSignoffShift.verification_status || 'unverified').toLowerCase() === 'verified'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : (editSignoffShift.verification_status || 'unverified').toLowerCase() === 'flagged'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}>
                {(editSignoffShift.verification_status || 'unverified').toUpperCase()}
              </span>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-stone-700 mb-2">Change status to</label>
              <select
                value={editSignoffStatus}
                onChange={(e) => {
                  setEditSignoffStatus(e.target.value);
                  if (e.target.value !== 'flagged') setEditSignoffReason('');
                }}
                className="w-full text-sm border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-[#800000] focus:border-[#800000] outline-none bg-white"
                disabled={editSignoffSaving}
              >
                <option value="unverified">UNVERIFIED</option>
                <option value="verified">VERIFIED</option>
                <option value="flagged">FLAGGED</option>
              </select>
            </div>

            {editSignoffStatus === 'flagged' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-stone-700 mb-2">Flag Reason</label>
                <textarea
                  rows={3}
                  value={editSignoffReason}
                  onChange={(e) => setEditSignoffReason(e.target.value)}
                  placeholder="Reason for flagging this shift..."
                  className="w-full text-sm border border-stone-200 rounded-xl p-3 focus:ring-2 focus:ring-[#800000] focus:border-[#800000] outline-none resize-none"
                  disabled={editSignoffSaving}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditSignoffShift(null)}
                disabled={editSignoffSaving}
                className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editSignoffStatus === 'flagged' && !editSignoffReason.trim()) {
                    toast.error("A flag reason is required.");
                    return;
                  }
                  setShowEditSignoffConfirm(true);
                }}
                disabled={editSignoffSaving || (editSignoffStatus === 'flagged' && !editSignoffReason.trim())}
                className="px-4 py-2 text-sm font-bold text-white bg-[#800000] hover:bg-red-900 rounded-xl transition-colors disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Edit Sign-off Modal */}
      {editSignoffShift && showEditSignoffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Confirm Sign-off Change</h3>
            <p className="text-sm text-stone-600 mb-6">
              Are you sure you want to change the audit sign-off from{' '}
              <span className="font-bold uppercase">{(editSignoffShift.verification_status || 'unverified')}</span>{' '}
              to{' '}
              <span className="font-bold uppercase">{editSignoffStatus}</span>?
              {editSignoffStatus === 'flagged' && editSignoffReason.trim() && (
                <><br /><span className="text-stone-500 mt-1 block">Reason: &ldquo;{editSignoffReason.trim()}&rdquo;</span></>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditSignoffConfirm(false)}
                disabled={editSignoffSaving}
                className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleEditSignoffSave}
                disabled={editSignoffSaving}
                className="px-4 py-2 text-sm font-bold text-white bg-[#800000] hover:bg-red-900 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {editSignoffSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editSignoffSaving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedShiftId && (
        <ShiftDetailsModal shiftId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
      )}
    </div>
  );
}

function ShiftDetailsModal({ shiftId, onClose }: { shiftId: string, onClose: () => void }) {
  const [shift, setShift] = useState<CashShift | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFloat, setAddingFloat] = useState(false);
  const [floatAmount, setFloatAmount] = useState("");
  const [floatReason, setFloatReason] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [shiftId]);

  const fetchDetails = async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) return;
      const res = await fetch(`${getApiUrl()}/api/cash/shifts/${shiftId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setShift(data.shift);
        setTransactions(data.transactions ?? []);
        // Expense rows: root array first, shift-attached fallback (contract
        // tolerant — details payload may carry either).
        const rows = Array.isArray(data.expenses)
          ? data.expenses
          : Array.isArray(data.shift?.expenses)
            ? data.shift.expenses
            : [];
        // Wire rows are snake_case (mapExpense) — normalize to ExpenseItem.
        setExpenses(normalizeExpenses(rows));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAddFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(floatAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Please enter a valid positive amount.");
    if (!floatReason.trim()) return toast.error("Please provide a reason.");
    
    setSubmitLoading(true);
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        toast.error("Authentication required.");
        return;
      }
      const res = await fetch(`${getApiUrl()}/api/cash/shifts/${shiftId}/add-float`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ amount, reason: floatReason })
      });
      const data = await res.json();
      if (data.success) {
        setAddingFloat(false);
        setFloatAmount("");
        setFloatReason("");
        await fetchDetails();
      } else {
        toast.error(data.message || "Failed to add float.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!shift && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-stone-100">
          <div>
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              Shift Details
              {shift?.status === 'open' && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-200">Open Shift</span>
              )}
            </h2>

          </div>
          <div className="flex items-center gap-3">
            {shift?.status === 'open' && !addingFloat && (
              <button 
                onClick={() => setAddingFloat(true)}
                className="px-3 py-1.5 bg-[#800000] text-white text-xs font-bold rounded-lg hover:bg-red-900 transition-colors"
              >
                + Add Cash to Float
              </button>
            )}
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center font-bold text-stone-400 text-sm">Loading details...</div>
        ) : shift ? (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Staff</span>
                <p className="font-bold text-lg text-stone-800">{shift.staff_name}</p>
              </div>
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Shift Status</span>
                <p className="font-bold text-lg capitalize text-stone-800">{shift.status === 'open' ? 'Open' : 'Closed'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Audit Sign-off</span>
                <p className="font-bold text-sm text-stone-800 mt-1">
                  {(shift.verification_status || 'unverified').toLowerCase() === 'verified'
                    ? `Verified${shift.verified_by_name ? ` by ${shift.verified_by_name}` : ''}${shift.verified_at ? ` · ${new Date(shift.verified_at).toLocaleString('en-PH')}` : ''}`
                    : (shift.verification_status || 'unverified').toLowerCase() === 'flagged'
                      ? `Flagged${shift.flag_reason ? `: ${shift.flag_reason}` : ''}`
                      : 'Unverified'}
                </p>
              </div>
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">End-of-Shift Notes</span>
                <p className="font-medium text-sm text-stone-700 mt-1">{shift.notes?.trim() ? shift.notes : <span className="text-stone-400 italic">No notes.</span>}</p>
              </div>
            </div>

            {addingFloat && (
              <form onSubmit={handleAddFloat} className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h3 className="font-bold text-blue-900 mb-3 text-sm flex items-center gap-2">
                  <PhilippinePeso className="w-4 h-4" /> Add Cash to Float
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1">Amount (₱)</label>
                    <input 
                      type="number" step="0.01" min="0.01" required
                      className="w-full text-sm border-blue-200 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      value={floatAmount} onChange={e => setFloatAmount(e.target.value)}
                      placeholder="e.g. 500"
                      disabled={submitLoading}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1">Reason</label>
                    <input 
                      type="text" required
                      className="w-full text-sm border-blue-200 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      value={floatReason} onChange={e => setFloatReason(e.target.value)}
                      placeholder="e.g. Additional change money"
                      disabled={submitLoading}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAddingFloat(false)} className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg" disabled={submitLoading}>Cancel</button>
                  <button type="submit" className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg" disabled={submitLoading}>
                    {submitLoading ? 'Adding...' : 'Confirm Addition'}
                  </button>
                </div>
              </form>
            )}

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center gap-2 text-stone-600 font-bold text-sm">
                <PhilippinePeso className="w-4 h-4" /> Reconciliation
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-6 gap-4 text-center divide-x divide-stone-100">
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Opening Float</p>
                  <p className="font-bold text-stone-700">₱{parseFloat(shift.starting_float as string).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Cash Sales</p>
                  <p className="font-bold text-emerald-700">₱{getCashSales(shift).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Expected</p>
                  <p className="font-bold text-[#800000]">₱{parseFloat(shift.expected_cash as string).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Expenses</p>
                  <p className="font-bold text-amber-700">₱{shiftExpensesNet(shift).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Counted Cash</p>
                  <p className="font-bold text-stone-900">{shift.actual_cash != null ? `₱${parseFloat(shift.actual_cash as string).toFixed(2)}` : "Pending"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Variance</p>
                  <p className={`font-bold ${shift.difference != null ? (parseFloat(shift.difference as string) < 0 ? 'text-rose-600' : parseFloat(shift.difference as string) > 0 ? 'text-blue-600' : 'text-emerald-600') : 'text-stone-400'}`}>
                    {shift.difference != null ? parseFloat(shift.difference as string).toFixed(2) : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm text-stone-800 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Cash Transactions Log
              </h3>
              {transactions.length === 0 ? (
                <div className="p-5 border border-stone-200 rounded-xl text-center text-sm text-stone-400 font-medium">
                  No cash transactions recorded in this shift.
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="px-3 py-2 text-stone-500 font-bold">Time</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Type</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Order ID</th>
                        <th className="px-3 py-2 text-stone-500 font-bold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {transactions.map(t => (
                        <tr key={t.id} className="hover:bg-stone-50">
                          <td className="px-3 py-2 text-stone-500">{new Date(t.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${t.type === 'float_addition' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
                              {t.type.replace('_', ' ')}
                            </span>
                            {t.type === 'float_addition' && t.reason && (
                              <div className="text-[10px] text-stone-500 mt-1">
                                By: {t.admin_name || 'Admin'} <br/>
                                <span className="italic">"{t.reason}"</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-stone-400">{t.order_id || "-"}</td>
                          <td className="px-3 py-2 text-right font-bold text-stone-900">₱{parseFloat(t.amount as string).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Shift Expenses — drawer paid-outs + admin-attached rows */}
            <div>
              <h3 className="font-bold text-sm text-stone-800 mb-3 flex items-center gap-2">
                <PhilippinePeso className="w-4 h-4 text-amber-600" /> Shift Expenses
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Net ₱{shiftExpensesNet({ expenses }).toFixed(2)}
                </span>
              </h3>
              {expenses.length === 0 ? (
                <div className="p-5 border border-stone-200 rounded-xl text-center text-sm text-stone-400 font-medium">
                  No expenses recorded in this shift.
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="px-3 py-2 text-stone-500 font-bold">Time</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Category</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Details</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Source</th>
                        <th className="px-3 py-2 text-stone-500 font-bold">Status</th>
                        <th className="px-3 py-2 text-stone-500 font-bold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {expenses.map((row) => {
                        const source = expenseSourceChip(row);
                        const status = expenseStatusChip(row);
                        const voided = row.status === "voided";
                        return (
                          <tr key={row.id} className="hover:bg-stone-50">
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">
                              {new Date(row.expenseDate || row.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2">
                              <span className={expenseCategoryChip().className}>{row.category || "—"}</span>
                            </td>
                            <td className="px-3 py-2 max-w-[240px]">
                              <div className="text-stone-700 font-semibold truncate">{row.reason || "—"}</div>
                              {(row.note || row.payee) && (
                                <div className="text-[10px] text-stone-500 mt-0.5">
                                  {row.payee ? <>Payee: {row.payee}</> : null}
                                  {row.payee && row.note ? " · " : ""}
                                  {row.note ? <span className="italic">"{row.note}"</span> : null}
                                </div>
                              )}
                              {row.createdByRole && (
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  By: {row.createdByName || "—"} ({row.createdByRole})
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={source.className}>{source.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={status.className} title={status.title}>{status.label}</span>
                            </td>
                            <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${voided ? "text-stone-400 line-through" : "text-stone-900"}`}>
                              {voided
                                ? `₱${parseFloat(row.amount as string).toFixed(2)}`
                                : `₱${Math.abs(parseFloat(row.amount as string) || 0).toFixed(2)}`}
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
        ) : null}
      </div>
    </div>
  );
}
