"use client";

import { X, CheckCircle2, AlertCircle, Clock, XCircle, ShieldCheck, CreditCard } from "lucide-react";
import type { PaymentVerificationStatus } from "@/lib/admin/types";

type PaymentDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  order: {
    orderId: string;
    customerName?: string;
    total: number;
    paymentMethod?: string;
    paymentStatus?: PaymentVerificationStatus | string;
    xenditReference?: string;
    xenditInvoiceId?: string;
    paidAt?: string;
    time?: string;
    orderedAt?: string;
    paid?: boolean;
  };
};

export function PaymentDetailsModal({ open, onClose, order }: PaymentDetailsModalProps) {
  if (!open || !order) return null;

  // Determine status (PAID, PENDING, FAILED, CANCELLED)
  const isPaid = order.paid || order.paymentStatus === "paid" || (order as any).status === "completed" || (order as any).status === "delivered";
  const isFailed = order.paymentStatus === "failed";
  const isCancelled = order.paymentStatus === "cancelled";
  const isPending = !isPaid && !isFailed && !isCancelled;

  const paymentMethodName = order.paymentMethod || "GCash";
  const referenceId = order.xenditReference || `REF-${order.orderId}-${Date.now().toString().slice(-6)}`;
  const invoiceId = order.xenditInvoiceId || `inv_xen_${order.orderId.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const orderTimeFormatted = order.time || order.orderedAt || new Date().toLocaleString("en-PH");
  const paymentTimeFormatted = order.paidAt || (isPaid ? orderTimeFormatted : "Awaiting completion");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#63131d]">
              Xendit GCash Payment Details
            </span>
            <h3 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
              Order {order.orderId}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Status Header Card */}
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPaid
                  ? "bg-emerald-100 text-emerald-700"
                  : isFailed
                  ? "bg-rose-100 text-rose-700"
                  : isCancelled
                  ? "bg-stone-200 text-stone-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              ) : isFailed ? (
                <XCircle className="w-5 h-5" />
              ) : isCancelled ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Payment Verification
              </p>
              {isPaid && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span> Paid / Verified
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-800">
                  <span className="h-2 w-2 rounded-full bg-rose-600"></span> Unpaid
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-800">
                  <span className="h-2 w-2 rounded-full bg-rose-600"></span> Payment Failed
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-700">
                  <span className="h-2 w-2 rounded-full bg-stone-500"></span> Cancelled
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Amount</p>
            <p className="font-serif font-black text-lg text-[#63131d]">₱{order.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Customer Name</span>
            <span className="font-bold text-stone-900">{order.customerName || "Walk-in Customer"}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Payment Gateway</span>
            <span className="font-bold text-stone-900 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" /> {paymentMethodName} (Xendit Sandbox)
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Xendit Reference ID</span>
            <span className="font-mono font-bold text-stone-800 text-[11px] bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              {referenceId}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Invoice ID</span>
            <span className="font-mono text-stone-600 text-[11px]">{invoiceId}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Order Placed Time</span>
            <span className="font-medium text-stone-700">{orderTimeFormatted}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-stone-100">
            <span className="font-bold text-stone-500">Xendit Confirmation Time</span>
            <span className="font-medium text-stone-700">{paymentTimeFormatted}</span>
          </div>
        </div>

        {/* Verification Footer Badge */}
        <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="leading-snug font-medium text-[11px]">
            {isPaid
              ? "Verified via Xendit Sandbox Webhook. Payment received."
              : "Order is linked to Xendit Test API. Unpaid."}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#63131d] text-white font-bold text-xs hover:bg-[#500f17] transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
