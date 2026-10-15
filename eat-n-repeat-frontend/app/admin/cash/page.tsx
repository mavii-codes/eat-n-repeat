"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Eye, Clock, ShieldCheck, PhilippinePeso, History, Flag, CheckCircle2, X, Loader2 } from "lucide-react";
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";
import type { CashShift, CashTransaction } from "@/lib/admin/types";

export default function CashManagementPage() {
  const [shifts, setShifts] = useState<CashShift[]>([]);
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

  const fetchShifts = useCallback(async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = getStaffOrAdminToken();
      if (!token) {
        setIsStale(true);
        setFetchError("Authentication required. Please log in as Admin.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${getApiUrl()}/api/cash/shifts`, {
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
  }, []);

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

  const getCashStatusBadge = (s: CashShift) => {
    if (s.difference == null) {
      return <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded border border-stone-200">{s.status}</span>;
    }
    const diff = typeof s.difference === 'number' ? s.difference : parseFloat(s.difference as string);
    if (isNaN(diff)) {
      return <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded border border-stone-200">{s.status}</span>;
    }
    if (diff === 0) return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200">Reconciled</span>;
    if (diff < 0) return <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200">Shortage</span>;
    if (diff > 0) return <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-200">Over</span>;
    return <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded border border-stone-200">{s.status}</span>;
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
          <div className="p-10 text-center text-stone-400 font-bold text-sm">No cash shifts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
<thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Shift Time</th>
                  <th className="px-4 py-3">Float</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Counted Cash</th>
                  <th className="px-4 py-3">Variance</th>
                  <th className="px-4 py-3 text-center">Shift Status</th>
                  <th className="px-4 py-3 text-center">Cash Status</th>
                  <th className="px-4 py-3 text-center">Audit Sign-off</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#800000]">{s.staff_name}</td>
                    <td className="px-4 py-3 text-stone-600">
                      <div>{new Date(s.start_time).toLocaleString('en-PH', { month: 'short', day: 'numeric' })}</div>
                      <div className="text-[10px] text-stone-400">
                        {new Date(s.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        {s.end_time ? ` - ${new Date(s.end_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : " - Present"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">₱{parseFloat(s.starting_float as string).toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium">₱{parseFloat(s.expected_cash as string).toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold text-stone-900">{s.actual_cash ? `₱${parseFloat(s.actual_cash as string).toFixed(2)}` : "-"}</td>
                    <td className="px-4 py-3 font-bold">
                      {s.difference != null ? (
                        <span className={parseFloat(s.difference as string) < 0 ? "text-rose-600" : parseFloat(s.difference as string) > 0 ? "text-blue-600" : "text-emerald-600"}>
                          {parseFloat(s.difference as string) === 0 ? "₱0.00" : parseFloat(s.difference as string) > 0 ? `+₱${parseFloat(s.difference as string).toFixed(2)}` : `-₱${Math.abs(parseFloat(s.difference as string)).toFixed(2)}`}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(s.status)}</td>
                  <td className="px-4 py-3">{getCashStatusBadge(s)}</td>
                  <td className="px-4 py-3 text-center">{getVerificationBadge(s)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                      {s.status !== 'open' && (s.verification_status || 'unverified').toLowerCase() !== 'verified' && (
                        <>
                          <button
                            onClick={() => setShowVerifyModal(s.id)}
                            disabled={verifyingId === s.id || flaggingId === s.id}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm mr-1.5"
                            title="Sign off this shift as verified"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              setShowFlagModal(s.id);
                              setFlagReason("");
                            }}
                            disabled={verifyingId === s.id || flaggingId === s.id}
                            className="px-2.5 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 disabled:opacity-50 text-rose-700 text-[10px] font-bold uppercase rounded-lg shadow-sm mr-1.5"
                            title="Flag this shift for discrepancy"
                          >
                            Flag
                          </button>
                        </>
                      )}
                      <button onClick={() => setSelectedShiftId(s.id)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 text-[#800000] shadow-sm" title="View details">
                        <Eye className="w-4 h-4" />
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
      
      {selectedShiftId && (
        <ShiftDetailsModal shiftId={selectedShiftId} onClose={() => setSelectedShiftId(null)} />
      )}
    </div>
  );
}

function ShiftDetailsModal({ shiftId, onClose }: { shiftId: string, onClose: () => void }) {
  const [shift, setShift] = useState<CashShift | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
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
        setTransactions(data.transactions);
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
            <p className="text-xs text-stone-500 font-mono mt-0.5">{shiftId}</p>
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
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Cash Status</span>
                <p className="font-bold text-lg capitalize text-stone-800">
                  {shift.difference == null
                    ? '—'
                    : Number(shift.difference) === 0
                      ? 'Reconciled'
                      : Number(shift.difference) < 0
                        ? 'Short'
                        : 'Over'}
                </p>
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
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-x divide-stone-100">
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Starting Float</p>
                  <p className="font-bold text-stone-700">₱{parseFloat(shift.starting_float as string).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Expected</p>
                  <p className="font-bold text-[#800000]">₱{parseFloat(shift.expected_cash as string).toFixed(2)}</p>
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
