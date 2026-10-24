"use client";

import { useState } from "react";
import type { DeliveryOrder, DeliveryStatus } from "@/lib/admin/types";
import {
  deliveryStatusLabels,
  deliveryStatusStyles,
  formatDeliveryDate,
} from "@/lib/admin/delivery-utils";
import { AdminSelect, AdminButton } from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { ProofOfDeliveryModal } from "@/components/admin/ProofOfDeliveryModal";
import { useAdminData } from "@/context/AdminDataContext";
import { Eye, Edit2, Check, X, MapPin, Phone, ShieldCheck, Clock, User, FileText, Camera } from "lucide-react";
import toast from "react-hot-toast";

type DeliveryOrdersTableProps = {
  orders: DeliveryOrder[];
  getServiceAreaName: (id: string) => string;
  onStatusChange?: (orderId: string, status: DeliveryStatus) => void;
  showStatusControl?: boolean;
  onArchive?: (order: DeliveryOrder) => void;
  onChat?: (order: DeliveryOrder) => void;
  disabled?: boolean;
};

export function DeliveryOrdersTable({
  orders,
  getServiceAreaName,
  onStatusChange,
  showStatusControl = false,
  onArchive,
  onChat,
  disabled = false,
}: DeliveryOrdersTableProps) {
  const { submitProofOfDelivery, updateDeliveryOrderPhone } = useAdminData();

  // Proof modal state
  const [proofOrder, setProofOrder] = useState<DeliveryOrder | null>(null);

  // Details modal state
  const [detailsOrder, setDetailsOrder] = useState<DeliveryOrder | null>(null);

  // Edit phone state inside details modal
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Photo viewer modal state
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const handleStatusSelect = (order: DeliveryOrder, newStatus: DeliveryStatus) => {
    if (disabled) return;
    if (newStatus === "delivered") {
      // Complete Delivery requires Proof of Delivery
      setProofOrder(order);
    } else if (onStatusChange) {
      onStatusChange(order.id, newStatus);
    }
  };

  const handleProofSubmit = async (proof: { photo: string; signature: string; note?: string | null }) => {
    if (!proofOrder) return;
    const res = await submitProofOfDelivery(proofOrder.id, proof);
    if (!res.success) {
      throw new Error(res.message || "Failed to submit proof of delivery.");
    }
  };

  const openDetails = (order: DeliveryOrder) => {
    setDetailsOrder(order);
    setIsEditingPhone(false);
    setEditedPhone(order.phone || "");
  };

  const handleSavePhone = async () => {
    if (!detailsOrder) return;
    if (!editedPhone.trim()) {
      toast.error("Phone number cannot be empty.");
      return;
    }
    setSavingPhone(true);
    try {
      const res = await updateDeliveryOrderPhone(detailsOrder.id, editedPhone.trim());
      if (res.success) {
        toast.success("Contact phone updated!");
        setDetailsOrder((prev) => (prev ? { ...prev, phone: editedPhone.trim() } : null));
        setIsEditingPhone(false);
      } else {
        toast.error(res.message || "Failed to update phone number.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update phone number.");
    } finally {
      setSavingPhone(false);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="font-medium text-[#800000]">No delivery orders found</p>
        <p className="mt-1 text-sm text-muted">
          Orders will appear here when customers place deliveries.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[640px] text-left text-sm [&_th]:px-2.5 [&_td]:px-2.5">
          <thead>
            <tr className="admin-table-head text-muted">
              <th className="rounded-l-lg px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ordered</th>
              <th className="rounded-r-lg px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-stone-50/50 transition-colors">
                <td
                  className="px-4 py-3 font-semibold text-accent text-xs max-w-[150px] truncate cursor-pointer hover:underline"
                  title={order.orderNumber}
                  aria-label={`Order ${order.orderNumber}`}
                  onClick={() => openDetails(order)}
                >
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[#800000]">{order.customerName}</p>
                  <p className="mt-0.5 text-xs text-muted">{order.phone}</p>
                  <p className="mt-0.5 text-xs text-muted truncate max-w-[200px]" title={order.address}>{order.address}</p>
                  {onChat && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChat(order)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer focus:outline-none disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Chat with Customer
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {getServiceAreaName(order.serviceAreaId)}
                </td>
                <td className="px-4 py-3 text-muted max-w-[160px] truncate" title={order.items}>
                  {order.items}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#800000]">
                    ₱{order.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted">
                    Fee: ₱{order.deliveryFee.toLocaleString()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {showStatusControl && onStatusChange && !disabled ? (
                    <AdminSelect
                      value={order.status}
                      disabled={disabled}
                      onChange={(e) =>
                        handleStatusSelect(
                          order,
                          e.target.value as DeliveryStatus,
                        )
                      }
                      className="min-w-[140px] py-1.5 text-xs"
                    >
                      {(Object.keys(deliveryStatusLabels) as DeliveryStatus[]).map(
                        (status) => (
                          <option key={status} value={status}>
                            {deliveryStatusLabels[status]}
                          </option>
                        ),
                      )}
                    </AdminSelect>
                  ) : (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${deliveryStatusStyles[order.status]}`}
                    >
                      {deliveryStatusLabels[order.status]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted text-xs">
                  {formatDeliveryDate(order.orderedAt)}
                  {order.deliveredAt && (
                    <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                      Delivered {formatDeliveryDate(order.deliveredAt)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openDetails(order)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-[#800000] shadow-2xs hover:bg-stone-50 transition"
                      title="View Details & Proof"
                      aria-label="View Details & Proof"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {onArchive && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onArchive(order)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Proof of Delivery Modal */}
      <ProofOfDeliveryModal
        open={Boolean(proofOrder)}
        order={proofOrder}
        onClose={() => setProofOrder(null)}
        onSubmit={handleProofSubmit}
      />

      {/* Full Delivery Order Details & Proof Modal */}
      <AdminModal
        open={Boolean(detailsOrder)}
        title={`Delivery Details — ${detailsOrder?.orderNumber}`}
        onClose={() => setDetailsOrder(null)}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {detailsOrder && detailsOrder.status !== "delivered" && detailsOrder.status !== "completed" && detailsOrder.status !== "cancelled" && !disabled && (
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => {
                  const target = detailsOrder;
                  setDetailsOrder(null);
                  setProofOrder(target);
                }}
                className="gap-1.5 text-xs"
              >
                <ShieldCheck className="h-4 w-4" />
                Complete Delivery & Proof
              </AdminButton>
            )}
            <button
              type="button"
              onClick={() => setDetailsOrder(null)}
              className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 transition"
            >
              Close
            </button>
          </div>
        }
      >
        {detailsOrder && (
          <div className="space-y-5 text-sm">
            {/* Header / Status Banner */}
            <div className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/70 p-4">
              <div>
                <p className="text-xs uppercase font-bold text-stone-500 tracking-wider">Status</p>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 mt-1 text-xs font-bold uppercase ${deliveryStatusStyles[detailsOrder.status]}`}>
                  {deliveryStatusLabels[detailsOrder.status]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-stone-500 tracking-wider">Total</p>
                <p className="font-serif text-lg font-bold text-[#800000]">₱{detailsOrder.total.toLocaleString()}</p>
                <p className="text-[11px] text-stone-500">Fee: ₱{detailsOrder.deliveryFee.toLocaleString()}</p>
              </div>
            </div>

            {/* Customer & Contact Section */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#800000]" />
                Customer & Contact Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-500">Customer Name:</span>
                  <p className="font-semibold text-stone-900 mt-0.5">{detailsOrder.customerName}</p>
                </div>

                <div>
                  <span className="text-stone-500">Contact Phone:</span>
                  {isEditingPhone ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="tel"
                        value={editedPhone}
                        onChange={(e) => setEditedPhone(e.target.value)}
                        placeholder="09XXXXXXXXX"
                        className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#800000]"
                      />
                      <button
                        type="button"
                        disabled={savingPhone}
                        onClick={handleSavePhone}
                        className="rounded-lg bg-emerald-700 text-white p-1 hover:bg-emerald-800 disabled:opacity-50"
                        title="Save Phone"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={savingPhone}
                        onClick={() => {
                          setIsEditingPhone(false);
                          setEditedPhone(detailsOrder.phone);
                        }}
                        className="rounded-lg bg-stone-200 text-stone-700 p-1 hover:bg-stone-300"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-semibold text-stone-900">{detailsOrder.phone || "None provided"}</p>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => setIsEditingPhone(true)}
                          className="text-stone-400 hover:text-[#800000] transition"
                          title="Edit Order Phone Number"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <span className="text-stone-500">Delivery Address:</span>
                  <p className="font-medium text-stone-900 mt-0.5 flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[#800000] shrink-0 mt-0.5" />
                    <span>{detailsOrder.address}</span>
                  </p>
                </div>

                {detailsOrder.notes && (
                  <div className="sm:col-span-2 pt-2 border-t border-stone-100">
                    <span className="text-stone-500">Order Notes:</span>
                    <p className="text-stone-700 mt-0.5 italic">{detailsOrder.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Manifest / Order Items */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#800000]" />
                Items Manifest
              </h4>
              <p className="text-xs text-stone-800 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-100">
                {detailsOrder.items}
              </p>
            </div>

            {/* Proof of Delivery Section (Part F requirement 29) */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#800000]" />
                  Proof of Delivery
                </h4>
                {detailsOrder.proofOfDeliveryPhoto || detailsOrder.proofOfDeliverySignature ? (
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-300">
                    Verified &amp; Submitted
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600 border border-stone-300">
                    Not Yet Submitted
                  </span>
                )}
              </div>

              {detailsOrder.proofOfDeliveryPhoto || detailsOrder.proofOfDeliverySignature ? (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Delivery Photo */}
                    <div>
                      <p className="text-xs font-semibold text-stone-600 mb-1.5 flex items-center gap-1">
                        <Camera className="h-3.5 w-3.5" /> Delivery Photo
                      </p>
                      {detailsOrder.proofOfDeliveryPhoto ? (
                        <div
                          className="relative rounded-lg border border-stone-200 overflow-hidden cursor-pointer group bg-stone-50"
                          onClick={() => setPreviewPhotoUrl(detailsOrder.proofOfDeliveryPhoto!)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={detailsOrder.proofOfDeliveryPhoto}
                            alt="Proof of Delivery Photo"
                            className="w-full h-32 object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition">
                            Click to expand
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">No photo attached</p>
                      )}
                    </div>

                    {/* Customer Signature */}
                    <div>
                      <p className="text-xs font-semibold text-stone-600 mb-1.5 flex items-center gap-1">
                        <Edit2 className="h-3.5 w-3.5" /> Customer Signature
                      </p>
                      {detailsOrder.proofOfDeliverySignature ? (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 flex items-center justify-center h-32 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={detailsOrder.proofOfDeliverySignature}
                            alt="Customer Signature"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">No signature recorded</p>
                      )}
                    </div>
                  </div>

                  {/* Note, Submitter & Timestamp */}
                  <div className="bg-stone-50 rounded-lg p-3 text-xs space-y-1.5 border border-stone-100">
                    {detailsOrder.proofOfDeliveryNote && (
                      <p className="text-stone-800">
                        <span className="font-semibold text-stone-500">Delivery Note: </span>
                        {detailsOrder.proofOfDeliveryNote}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-stone-500 pt-1">
                      {detailsOrder.proofOfDeliverySubmittedBy && (
                        <span>
                          <strong>Delivered by:</strong> {detailsOrder.proofOfDeliverySubmittedBy}
                        </span>
                      )}
                      {(detailsOrder.proofOfDeliverySubmittedAt || detailsOrder.deliveredAt) && (
                        <span>
                          <strong>Delivered at:</strong> {formatDeliveryDate(detailsOrder.proofOfDeliverySubmittedAt || detailsOrder.deliveredAt!)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 text-center text-xs text-stone-500">
                  <p>Proof of delivery (photo &amp; signature) will be captured when the order is marked Delivered.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminModal>

      {/* Expanded Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhotoUrl}
              alt="Expanded Proof"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 text-white p-2 hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
