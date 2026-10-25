"use client";

import { useState, useMemo } from "react";
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
import { useAuth } from "@/context/AuthContext";
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

function OrderItemsRenderer({ items }: { items: unknown }) {
  if (!items) {
    return <span className="text-stone-400 italic text-xs">No items recorded</span>;
  }

  let parsed = items;
  if (typeof items === "string") {
    try {
      parsed = JSON.parse(items);
    } catch {
      const lines = items.split(/[\r\n]+/).filter(Boolean);
      if (lines.length > 0) {
        return (
          <ul className="space-y-1.5 text-xs text-stone-800">
            {lines.map((line, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#800000] shrink-0" />
                <span className="font-medium">{line}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <p className="text-xs text-stone-800">{items}</p>;
    }
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    return (
      <div className="divide-y divide-stone-100 text-xs">
        {parsed.map((item: any, idx: number) => {
          const qty = item.quantity || item.qty || 1;
          const name = item.name || item.title || "Item";
          const price = item.price ? Number(item.price) : 0;
          return (
            <div key={idx} className="py-1.5 flex items-center justify-between gap-2 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-accent-light text-accent text-[11px] font-bold shrink-0">
                  {qty}×
                </span>
                <span className="font-semibold text-stone-900">{name}</span>
              </div>
              {price > 0 && (
                <span className="text-stone-600 font-medium">₱{(price * qty).toFixed(2)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <p className="text-xs text-stone-800">{String(items)}</p>;
}

export function DeliveryOrdersTable({
  orders,
  getServiceAreaName,
  onStatusChange,
  showStatusControl = false,
  onArchive,
  onChat,
  disabled = false,
}: DeliveryOrdersTableProps) {
  const { submitProofOfDelivery, updateDeliveryOrderPhone, staffAccounts } = useAdminData();
  const { user } = useAuth();

  const getStaffDisplayName = (identifier?: string | null): string => {
    if (!identifier) return "Staff";
    if (user?.id && identifier === user.id) return user.name || "Staff";
    const matched = staffAccounts?.find(
      (acc) => acc.id === identifier || acc.username === identifier
    );
    if (matched?.name) return matched.name;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) return user?.name || "Staff";
    return identifier;
  };

  // Proof modal state
  const [proofOrder, setProofOrder] = useState<DeliveryOrder | null>(null);

  // Details modal state
  const [detailsOrder, setDetailsOrder] = useState<DeliveryOrder | null>(null);

  // Keep details synced with the latest live order data
  const currentDetailsOrder = useMemo(() => {
    if (!detailsOrder) return null;
    return (
      orders.find(
        (o) => o.id === detailsOrder.id || o.orderNumber === detailsOrder.orderNumber
      ) || detailsOrder
    );
  }, [detailsOrder, orders]);

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

  const handleProofSubmit = async (proof: { photo: string; signature: string; note?: string | null; submittedBy?: string }) => {
    if (!proofOrder) return;
    const res = await submitProofOfDelivery(proofOrder.id, {
      ...proof,
      submittedBy: user?.name || "Admin",
    });
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
        maxWidth="4xl"
        className="!p-4 sm:!p-5"
      >
        {currentDetailsOrder && (
          <div className="space-y-3 text-sm">
            {/* Top Status & Financial Overview Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50/70 border border-amber-200/70 px-3.5 py-2">
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${deliveryStatusStyles[currentDetailsOrder.status]}`}>
                  {deliveryStatusLabels[currentDetailsOrder.status]}
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  {currentDetailsOrder.orderedAt ? `Ordered ${formatDeliveryDate(currentDetailsOrder.orderedAt)}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div className="text-xs">
                  <span className="text-stone-500 mr-1.5 font-medium">Fee:</span>
                  <span className="font-semibold text-stone-700">₱{Number(currentDetailsOrder.deliveryFee || 0).toFixed(2)}</span>
                </div>
                <div className="border-l border-stone-300 pl-4 text-xs">
                  <span className="text-stone-500 mr-1.5 font-bold">Total:</span>
                  <span className="font-serif font-bold text-[#800000] text-base">
                    ₱{Number(currentDetailsOrder.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Left Column: Customer & Manifest */}
              <div className="md:col-span-6 space-y-2.5">
                {/* Customer & Destination Card */}
                <div className="rounded-xl border border-stone-200/90 bg-white p-3 space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                    <User className="h-3.5 w-3.5 text-[#800000]" />
                    Customer &amp; Contact Details
                  </h4>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-stone-400 text-[11px] block font-medium">Customer Name</span>
                      <p className="font-semibold text-stone-900 truncate mt-0.5">{currentDetailsOrder.customerName}</p>
                    </div>

                    <div>
                      <span className="text-stone-400 text-[11px] block font-medium">Contact Phone</span>
                      {isEditingPhone ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="tel"
                            value={editedPhone}
                            onChange={(e) => setEditedPhone(e.target.value)}
                            placeholder="09XXXXXXXXX"
                            className="w-full rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#800000]"
                          />
                          <button
                            type="button"
                            disabled={savingPhone}
                            onClick={handleSavePhone}
                            className="rounded bg-emerald-700 text-white p-1 hover:bg-emerald-800 disabled:opacity-50"
                            title="Save Phone"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={savingPhone}
                            onClick={() => {
                              setIsEditingPhone(false);
                              setEditedPhone(currentDetailsOrder.phone);
                            }}
                            className="rounded bg-stone-200 text-stone-700 p-1 hover:bg-stone-300"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="font-semibold text-stone-900 text-xs truncate">{currentDetailsOrder.phone || "None"}</p>
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => setIsEditingPhone(true)}
                              className="text-stone-400 hover:text-[#800000] transition"
                              title="Edit Phone Number"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-stone-50/80 p-2 rounded-lg border border-stone-200/70 text-xs flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#800000] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900 text-xs leading-snug">{currentDetailsOrder.address}</p>
                      {currentDetailsOrder.serviceAreaId && (
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          Area: {getServiceAreaName(currentDetailsOrder.serviceAreaId)}
                        </p>
                      )}
                    </div>
                  </div>

                  {currentDetailsOrder.notes && (
                    <p className="text-[11px] text-stone-600 bg-amber-50/60 p-2 rounded border border-amber-200/60 italic">
                      "{currentDetailsOrder.notes}"
                    </p>
                  )}
                </div>

                {/* Items Manifest Card */}
                <div className="rounded-xl border border-stone-200/90 bg-white p-3 space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#800000]" />
                    Items Manifest
                  </h4>
                  <div className="bg-stone-50/80 rounded-lg p-2 border border-stone-200/70 max-h-28 overflow-y-auto text-xs">
                    <OrderItemsRenderer items={currentDetailsOrder.items} />
                  </div>
                </div>
              </div>

              {/* Right Column: Proof of Delivery */}
              <div className="md:col-span-6">
                <div className="rounded-xl border border-stone-200/90 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Proof of Delivery
                    </h4>
                    {currentDetailsOrder.proofOfDeliveryPhoto || currentDetailsOrder.proofOfDeliverySignature ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-300">
                        <Check className="h-2.5 w-2.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600 border border-stone-300">
                        Pending Proof
                      </span>
                    )}
                  </div>

                  {currentDetailsOrder.proofOfDeliveryPhoto || currentDetailsOrder.proofOfDeliverySignature ? (
                    <div className="space-y-2">
                      {/* Photo and Signature Side by Side */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Photo Section */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600 mb-1">
                            <span className="flex items-center gap-1">
                              <Camera className="h-3 w-3 text-stone-500" /> Photo
                            </span>
                            {currentDetailsOrder.proofOfDeliveryPhoto && (
                              <span className="text-[9px] text-[#800000] font-semibold">Expand</span>
                            )}
                          </div>
                          {currentDetailsOrder.proofOfDeliveryPhoto ? (
                            <div
                              className="relative rounded-lg border border-stone-200 overflow-hidden cursor-pointer group bg-stone-100 shadow-2xs h-24 sm:h-28 flex items-center justify-center"
                              onClick={() => setPreviewPhotoUrl(currentDetailsOrder.proofOfDeliveryPhoto!)}
                            >
                              <img
                                src={currentDetailsOrder.proofOfDeliveryPhoto}
                                alt="Proof Photo"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-semibold gap-1 transition backdrop-blur-[1px]">
                                <Camera className="h-3 w-3" /> View Photo
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 h-24 sm:h-28 flex items-center justify-center text-center text-[10px] text-stone-400 italic">
                              No photo
                            </div>
                          )}
                        </div>

                        {/* Customer Signature Section */}
                        <div>
                          <p className="text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                            <Edit2 className="h-3 w-3 text-stone-500" /> Signature
                          </p>
                          {currentDetailsOrder.proofOfDeliverySignature ? (
                            <div className="rounded-lg border border-stone-200 bg-stone-50 p-1 flex items-center justify-center h-24 sm:h-28 overflow-hidden shadow-2xs">
                              <img
                                src={currentDetailsOrder.proofOfDeliverySignature}
                                alt="Customer Signature"
                                className="max-h-full max-w-full object-contain filter contrast-125"
                              />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 h-24 sm:h-28 flex items-center justify-center text-center text-[10px] text-stone-400 italic">
                              No signature
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Audit Details */}
                      <div className="rounded-lg bg-stone-50/90 border border-stone-200/80 p-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                            <User className="h-3 w-3 text-stone-400" /> Delivered by:
                          </span>
                          <span className="font-semibold text-stone-900 text-[11px]">
                            {getStaffDisplayName(currentDetailsOrder.proofOfDeliverySubmittedBy)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100 pt-1">
                          <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                            <Clock className="h-3 w-3 text-stone-400" /> Delivered at:
                          </span>
                          <span className="font-semibold text-stone-900 text-[11px]">
                            {formatDeliveryDate(currentDetailsOrder.proofOfDeliverySubmittedAt || currentDetailsOrder.deliveredAt!)}
                          </span>
                        </div>
                        {currentDetailsOrder.proofOfDeliveryNote && (
                          <div className="border-t border-stone-100 pt-1">
                            <span className="text-stone-500 text-[10px] font-medium">Note:</span>
                            <p className="text-stone-700 text-[11px] italic">
                              "{currentDetailsOrder.proofOfDeliveryNote}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Re-upload / Update affordance */}
                      {!disabled && (
                        <div className="text-right pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const target = currentDetailsOrder;
                              setDetailsOrder(null);
                              setProofOrder(target);
                            }}
                            className="text-[11px] font-semibold text-[#800000] hover:underline cursor-pointer"
                          >
                            Update / Replace Proof
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center space-y-2.5 my-1">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                        <Camera className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-stone-800 text-xs">Awaiting Delivery Proof</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5 max-w-xs mx-auto">
                          Photo and customer signature will appear here when completed by staff/rider.
                        </p>
                      </div>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = currentDetailsOrder;
                            setDetailsOrder(null);
                            setProofOrder(target);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#800000] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#660000] transition cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Upload Proof of Delivery
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Close Button */}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailsOrder(null)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
              >
                Close
              </button>
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
