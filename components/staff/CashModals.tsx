"use client";

import { useState } from "react";
import { X, Calculator, PhilippinePeso, AlertCircle, Clock } from "lucide-react";

export function StartShiftModal({ open, onStart }: { open: boolean, onStart: (float: number) => Promise<void> }) {
  const [float, setFloat] = useState<string>("1000");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onStart(parseFloat(float));
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-amber-100 text-amber-700 p-2 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Start Cash Shift</h2>
            <p className="text-xs text-stone-500">Please declare your starting drawer float</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Starting Cash Float (₱)</label>
            <input 
              type="number" 
              required min="0" step="1"
              value={float} 
              onChange={(e) => setFloat(e.target.value)}
              className="w-full text-2xl font-bold p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#800000] focus:border-[#800000]"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-[#800000] text-white font-bold rounded-xl hover:bg-[#600000] transition-colors"
          >
            {loading ? "Starting..." : "Start Shift"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function EndShiftModal({ open, shift, onEnd, onClose }: { open: boolean, shift: any, onEnd: (cash: number) => Promise<void>, onClose: () => void }) {
  const [actual, setActual] = useState<string>(shift?.expected_cash || "0");
  const [loading, setLoading] = useState(false);

  if (!open || !shift) return null;

  const expected = parseFloat(shift.expected_cash || 0);
  const diff = parseFloat(actual) - expected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onEnd(parseFloat(actual));
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold text-stone-900 mb-5">Cash Reconciliation</h2>
        
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-stone-500">Starting Float</span>
            <span className="font-bold">₱{parseFloat(shift.starting_float).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Cash Sales (approx)</span>
            <span className="font-bold">₱{(expected - parseFloat(shift.starting_float)).toFixed(2)}</span>
          </div>
          <div className="border-t border-stone-200 my-2 pt-2 flex justify-between">
            <span className="text-stone-700 font-bold uppercase text-[10px]">Expected Cash</span>
            <span className="font-bold text-[#800000] text-lg">₱{expected.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Actual Cash Counted (₱)</label>
            <input 
              type="number" 
              required min="0" step="0.01"
              value={actual} 
              onChange={(e) => setActual(e.target.value)}
              className="w-full text-2xl font-bold p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#800000] focus:border-[#800000]"
            />
          </div>

          {actual !== "" && (
            <div className={`p-3 rounded-lg border flex items-center justify-between ${diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : diff < 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <span className="font-bold text-xs uppercase">Difference</span>
              <span className="font-bold text-lg">
                {diff === 0 ? "₱0 (MATCHED)" : diff < 0 ? `-\u20B1${Math.abs(diff).toFixed(2)} (SHORT)` : `+\u20B1${diff.toFixed(2)} (OVER)`}
              </span>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-stone-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
          >
            {loading ? "Submitting..." : "Submit Cash Count & End Shift"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CashPaymentModal({ open, order, onConfirm, onClose }: { open: boolean, order: any, onConfirm: (cash: number) => Promise<any>, onClose: () => void }) {
  const [cash, setCash] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !order) return null;

  const total = order.total || (order.subtotal + (order.deliveryFee || 0));
  const cashNum = parseFloat(cash) || 0;
  const change = cashNum - total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cashNum < total) {
      setError(`Insufficient payment. Need ₱${(total - cashNum).toFixed(2)} more.`);
      return;
    }
    setError("");
    setLoading(true);
    const res = await onConfirm(cashNum);
    setLoading(false);
    if (!res.success) {
      setError(res.message || "Failed to confirm payment");
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col gap-1 mb-5 border-b border-stone-100 pb-4">
          <h2 className="text-xl font-bold text-[#800000] flex items-center gap-2">
            <PhilippinePeso className="w-5 h-5" />
            {order.orderType === 'dine-in' ? 'Dine-In Payment' : 'Cash Payment'}
          </h2>
          <p className="text-sm font-bold text-stone-900 mt-2">
            Order <span className="font-mono text-rose-900">#{order.orderId || order.id}</span>
          </p>
          {order.orderType === 'dine-in' && order.tableNumber && (
            <p className="text-xs font-semibold text-stone-500">
              Table: {order.tableNumber}
            </p>
          )}
        </div>
        
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-5 flex justify-between items-center">
          <span className="text-stone-500 font-bold uppercase text-[10px] tracking-wider">Total</span>
          <span className="font-serif font-black text-2xl text-stone-900">₱{total.toFixed(2)}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">Cash Received</label>
            <input 
              type="number" 
              required min={total} step="0.01"
              value={cash} 
              onChange={(e) => {
                setCash(e.target.value);
                setError("");
              }}
              className="w-full text-3xl font-bold p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#800000] focus:border-[#800000] text-center"
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 justify-center">
            <button type="button" onClick={() => setCash(total.toString())} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold hover:bg-stone-200">Exact</button>
            <button type="button" onClick={() => setCash("500")} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold hover:bg-stone-200">₱500</button>
            <button type="button" onClick={() => setCash("1000")} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold hover:bg-stone-200">₱1,000</button>
          </div>

          {cashNum >= total && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-emerald-900">
              <span className="font-bold text-xs uppercase tracking-wider">Change Due</span>
              <span className="font-bold text-xl">₱{change.toFixed(2)}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-xs font-bold">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading || cashNum < total}
            className="w-full py-4 bg-[#800000] disabled:bg-stone-300 text-white font-bold rounded-xl hover:bg-[#600000] transition-colors"
          >
            {loading ? "Confirming..." : `Confirm that you received ₱${cashNum > 0 ? cashNum.toFixed(2) : '...'} cash for Order ${order.orderId || order.id}?`}
          </button>
        </form>
      </div>
    </div>
  );
}
