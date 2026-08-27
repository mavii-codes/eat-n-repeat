"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Eye, Clock, ShieldCheck, PhilippinePeso, History } from "lucide-react";
import { X } from "lucide-react";
import type { CashShift, CashTransaction } from "@/lib/admin/types";

export default function CashManagementPage() {
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-admin-token') || localStorage.getItem('eat-n-repeat-staff-token');
      const res = await fetch(`${getApiUrl()}/api/cash/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setShifts(data.shifts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-200">Open Shift</span>;
      case 'matched': return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200">Matched</span>;
      case 'short': return <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200">Short</span>;
      case 'over': return <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-200">Over</span>;
      default: return <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded border border-stone-200">{status}</span>;
    }
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
          </div>
          <button onClick={fetchShifts} className="text-xs font-bold text-stone-500 hover:text-stone-800">
            Refresh
          </button>
        </div>

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
                  <th className="px-4 py-3">Actual</th>
                  <th className="px-4 py-3">Difference</th>
                  <th className="px-4 py-3 text-center">Status</th>
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
                    <td className="px-4 py-3 text-center">{getStatusBadge(s.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelectedShiftId(s.id)} className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 text-[#800000] shadow-sm">
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

  useEffect(() => {
    fetchDetails();
  }, [shiftId]);

  const fetchDetails = async () => {
    try {
      const { getApiUrl } = await import('@/lib/config');
      const token = localStorage.getItem('eat-n-repeat-admin-token') || localStorage.getItem('eat-n-repeat-staff-token');
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

  if (!shift && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-stone-100">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Shift Details</h2>
            <p className="text-xs text-stone-500 font-mono mt-0.5">{shiftId}</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
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
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Status</span>
                <p className="font-bold text-lg capitalize text-stone-800">{shift.status}</p>
              </div>
            </div>

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
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider mb-1">Actual Count</p>
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
                          <td className="px-3 py-2 capitalize font-medium text-stone-700">{t.type}</td>
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
