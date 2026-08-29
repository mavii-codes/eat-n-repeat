'use client';

import { useState } from 'react';
import { WriteReviewModal } from './WriteReviewModal';
import { CustomerReceiptModal } from './CustomerReceiptModal';
import { useReviews } from '@/context/ReviewsContext';
import { 
  Hourglass, Check, ChefHat, CheckCheck, Bike, BadgeCheck, 
  XCircle, PartyPopper, Utensils, Zap, FileText, Lock, 
  Bell, Receipt, RefreshCw, Star, ChevronUp, ChevronDown, Banknote
} from 'lucide-react';
export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderCardProps = {
  id: string;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: {
    id?: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  estimatedTime?: string;
  deliveryType: 'dine-in' | 'delivery';
  notes?: string;
  onReorder?: (items: { name: string; quantity: number; price: number }[]) => void;
  onCancelOrder?: (orderId: string) => void;
  pendingAt?: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyForDeliveryAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
};

const statusConfig: Record<
  OrderStatus,
  { color: string; icon: React.ReactNode; label: string; progress: number; estWait: string }
> = {
  pending: {
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: <Hourglass className="w-3.5 h-3.5" />,
    label: 'Order Pending',
    progress: 15,
    estWait: '~30-40 mins',
  },
  awaiting_payment: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: <Hourglass className="w-3.5 h-3.5" />,
    label: 'Awaiting Payment',
    progress: 5,
    estWait: 'Pending Payment',
  },
  confirmed: {
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: <Check className="w-3.5 h-3.5" />,
    label: 'Order Confirmed',
    progress: 35,
    estWait: '~25-35 mins',
  },
  preparing: {
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: <ChefHat className="w-3.5 h-3.5" />,
    label: 'Kitchen Preparing',
    progress: 65,
    estWait: '~15-20 mins',
  },
  ready: {
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: <CheckCheck className="w-3.5 h-3.5" />,
    label: 'Ready for Pick-Up',
    progress: 85,
    estWait: '~5-10 mins',
  },
  out_for_delivery: {
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: <Bike className="w-3.5 h-3.5" />,
    label: 'Out for Delivery',
    progress: 85,
    estWait: '~5-10 mins',
  },
  delivered: {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: <BadgeCheck className="w-3.5 h-3.5" />,
    label: 'Delivered & Completed',
    progress: 100,
    estWait: 'Completed',
  },
  cancelled: {
    color: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'Order Cancelled',
    progress: 0,
    estWait: 'N/A',
  },
};

const timelineStages = [
  { key: 'pending', label: 'Pending', icon: <Hourglass className="w-4 h-4" /> },
  { key: 'confirmed', label: 'Confirmed', icon: <Check className="w-4 h-4" /> },
  { key: 'preparing', label: 'Preparing', icon: <ChefHat className="w-4 h-4" /> },
  { key: 'out_for_delivery', label: 'On Way / Ready', icon: <Bike className="w-4 h-4" /> },
  { key: 'delivered', label: 'Completed', icon: <PartyPopper className="w-4 h-4" /> },
];

function getStageIndex(status: OrderStatus): number {
  switch (status) {
    case 'pending':
    case 'awaiting_payment':
      return 0;
    case 'confirmed':
      return 1;
    case 'preparing':
      return 2;
    case 'ready':
    case 'out_for_delivery':
      return 3;
    case 'delivered':
      return 4;
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

export function OrderCard({
  id,
  orderNumber,
  date,
  status,
  total,
  subtotal: propSubtotal,
  deliveryFee: propDeliveryFee,
  discount = 0,
  paymentMethod = 'Cash on Delivery',
  customerName = 'Valued Customer',
  customerPhone = '(032) 492-0000',
  customerAddress = 'Poblacion, Cordova, Cebu',
  items,
  estimatedTime: propEstTime,
  deliveryType,
  notes,
  onReorder,
  onCancelOrder,
  pendingAt,
  confirmedAt,
  preparingAt,
  readyForDeliveryAt,
  outForDeliveryAt,
  deliveredAt,
}: OrderCardProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const currentStageIndex = getStageIndex(status);
  const isPending = status === 'pending';
  const isAwaitingPayment = status === 'awaiting_payment';
  const isDelivered = status === 'delivered';
  const isCancelled = status === 'cancelled';
  const isActive = !isDelivered && !isCancelled;

  const calculatedSubtotal =
    propSubtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const calculatedDeliveryFee =
    propDeliveryFee ?? (deliveryType === 'delivery' ? (calculatedSubtotal > 350 ? 0 : 45) : 0);

  const { hasReviewedOrder, addReview } = useReviews();
  const alreadyReviewed = hasReviewedOrder(id);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reorderedToast, setReorderedToast] = useState(false);

  // Generate automated notification history timestamps using REAL database timestamps
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const notifications = [
    { title: 'Order Submitted', desc: 'Order received by Eat n\' RepEat Café.', time: formatTime(pendingAt) || date, stage: 0 },
    confirmedAt && { title: 'Order Confirmed', desc: 'Kitchen acknowledged order & assigned ticket.', time: formatTime(confirmedAt), stage: 1 },
    preparingAt && { title: 'Kitchen Preparing', desc: 'Baristas & chefs preparing your food fresh.', time: formatTime(preparingAt), stage: 2 },
    (readyForDeliveryAt || outForDeliveryAt) && { title: 'Out for Delivery / Ready', desc: 'Rider dispatched or ready at counter.', time: formatTime(outForDeliveryAt || readyForDeliveryAt), stage: 3 },
    deliveredAt && { title: 'Order Completed', desc: 'Delivered to customer. Enjoy your meal!', time: formatTime(deliveredAt), stage: 4 },
  ].filter(Boolean) as { title: string; desc: string; time: string; stage: number }[];

  const handleReviewSubmit = (
    rating: number,
    comment: string,
    menuItemId: string,
    menuItemName: string,
    reviewerName: string
  ) => {
    addReview({
      orderId: id,
      menuItemId,
      menuItemName,
      customerName: reviewerName,
      customerEmail: '',
      rating,
      comment,
    });
  };

  const handleReorderClick = () => {
    if (onReorder) {
      onReorder(items);
      setReorderedToast(true);
      setTimeout(() => setReorderedToast(false), 2500);
    }
  };

  const handleConfirmCancel = () => {
    if (onCancelOrder && !isDelivered && !isCancelled) {
      onCancelOrder(id);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      <div className="group relative rounded-3xl border border-amber-200/80 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
        {/* Top Header Card */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-amber-100/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-black text-[#451a03]">Order #{orderNumber}</p>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-[#451a03] flex items-center gap-1">
                  {deliveryType === 'dine-in' ? (
                    <><Utensils className="w-3.5 h-3.5" /> Dine-In</>
                  ) : (
                    <><Bike className="w-3.5 h-3.5" /> Express Delivery</>
                  )}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-semibold mt-0.5">Ordered on {date}</p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-2xs ${config.color}`}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </span>
            </div>
          </div>

          {/* Cash Dine-In Payment Notice */}
          {isAwaitingPayment && paymentMethod !== 'GCash' && deliveryType === 'dine-in' && (
            <div className="mb-6 p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <h4 className="font-black text-sm">Payment Required</h4>
                  <p className="text-xs font-medium opacity-90 mt-0.5 leading-relaxed">
                    Please proceed to the cashier to complete your payment of <strong>₱{total.toFixed(2)}</strong>. Your order will only be processed after payment is confirmed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* GCash Unpaid Notice */}
          {isAwaitingPayment && paymentMethod === 'GCash' && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h4 className="font-black text-sm">Payment Not Completed</h4>
                  <p className="text-xs font-medium opacity-90 mt-0.5 leading-relaxed">
                    Your GCash payment was not completed or verified yet. Please try again from the top of the orders page if it failed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Progress Bar */}
          {!isCancelled && (
            <div className="mb-6 bg-[#FFF9F2] p-4 rounded-2xl border border-amber-200/60">
              <div className="flex justify-between items-center text-xs font-bold text-stone-700 mb-2">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Progress Tracking</span>
                  <span className="text-[10px] text-stone-400 font-normal">({config.progress}%)</span>
                </span>
                <span className="text-[#B91C1C] font-extrabold">
                  Est. Wait: {propEstTime || config.estWait}
                </span>
              </div>
              <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-[#B91C1C] to-red-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${config.progress}%` }}
                />
              </div>

              {/* 5-Stage Order Timeline */}
              <div className="grid grid-cols-5 gap-1 mt-4 pt-3 border-t border-amber-200/50 text-center">
                {timelineStages.map((stage, idx) => {
                  const isPassed = currentStageIndex >= idx;
                  const isCurrent = currentStageIndex === idx;

                  return (
                    <div key={stage.key} className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          isCurrent
                            ? 'bg-[#B91C1C] text-white ring-4 ring-red-200 scale-110 shadow-md'
                            : isPassed
                            ? 'bg-amber-500 text-white'
                            : 'bg-stone-200 text-stone-400'
                        }`}
                      >
                        {stage.icon}
                      </div>
                      <span
                        className={`text-[10px] mt-1 font-bold line-clamp-1 ${
                          isCurrent
                            ? 'text-[#B91C1C]'
                            : isPassed
                            ? 'text-[#451a03]'
                            : 'text-stone-400'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Itemized Order Details & Payment Summary */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Items List */}
            <div>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider mb-2">
                Ordered Items ({items.reduce((s, i) => s + i.quantity, 0)})
              </p>
              <div className="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-stone-700 font-medium">
                      {item.name} <span className="text-[#B91C1C] font-black">×{item.quantity}</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70 space-y-2">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider mb-1">
                Payment Summary
              </p>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Subtotal</span>
                <span>₱{calculatedSubtotal.toFixed(2)}</span>
              </div>
              {deliveryType === 'delivery' && (
                <div className="flex justify-between text-xs text-stone-600">
                  <span>Delivery Fee</span>
                  <span>{calculatedDeliveryFee > 0 ? `₱${calculatedDeliveryFee.toFixed(2)}` : 'FREE'}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-₱{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-stone-600 pt-1 border-t border-stone-200">
                <span>Payment Method</span>
                <span className="font-bold text-emerald-700">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#451a03] pt-1.5 border-t border-stone-300">
                <span>Total Amount</span>
                <span className="text-lg text-[#B91C1C]">₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Special Instructions Section */}
          <div className="mb-6 p-4 bg-stone-50 rounded-2xl border border-stone-200/70">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Special Instructions
            </p>
            {notes && notes.trim().length > 0 ? (
              <p className="text-xs font-semibold text-[#451a03] bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 leading-relaxed italic">
                "{notes}"
              </p>
            ) : (
              <p className="text-xs text-stone-400 italic">No special instructions.</p>
            )}
          </div>

          {/* Cancellation Rules & Notice */}
          {!isCancelled && !isDelivered && (
            <div className="mb-4">
              {isPending ? (
                <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-800 font-semibold">
                    Order is currently Pending. You can cancel if needed.
                  </p>
                  {showCancelConfirm ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmCancel}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-black hover:bg-rose-700 transition"
                      >
                        Confirm Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        className="px-2.5 py-1 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold"
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-extrabold border border-rose-300 transition"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-stone-100 rounded-xl border border-stone-200/80 text-xs text-stone-600 font-medium flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>
                    <span className="font-bold text-stone-800">Cancellation Unavailable:</span> Order is
                    already confirmed and in kitchen preparation.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notification History Toggle */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-xs font-extrabold text-stone-600 hover:text-[#B91C1C] flex items-center gap-1.5 transition"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notification History ({notifications.length})</span>
              {showNotifications ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showNotifications && (
              <div className="mt-2 p-3.5 bg-[#FFF9F2] rounded-2xl border border-amber-200/60 space-y-2">
                {notifications.map((note, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-[#451a03]">{note.title}</p>
                      <p className="text-[11px] text-stone-500">{note.desc}</p>
                    </div>
                    <span className="text-[10px] text-stone-400 font-semibold shrink-0">
                      {note.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reorder Toast */}
          {reorderedToast && (
            <div className="mb-4 p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black rounded-xl text-center animate-bounce flex justify-center items-center gap-1.5">
              <Check className="w-4 h-4" /> All items from this order have been added to your cart!
            </div>
          )}

          {/* Action Bar Footer */}
          <div className="pt-4 border-t border-amber-100/80 flex flex-wrap items-center gap-3">
            {/* View Receipt Button */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" /> View / Print Receipt
            </button>

            {/* RepEat Order Button (Completed Orders) */}
            {isDelivered && onReorder && (
              <button
                type="button"
                onClick={handleReorderClick}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black text-xs shadow-md shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> RepEat This Order
              </button>
            )}

            {/* Write Review Button (Completed Orders) */}
            {isDelivered && (
              <div className="ml-auto">
                {alreadyReviewed ? (
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Review Submitted
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="py-2.5 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-xs shadow-md shadow-red-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <Star className="w-4 h-4" /> Write a Review
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <WriteReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleReviewSubmit}
        orderNumber={orderNumber}
        orderItems={items}
        alreadyReviewed={alreadyReviewed}
      />

      {/* Receipt Modal */}
      <CustomerReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        orderNumber={orderNumber}
        date={date}
        customerName={customerName}
        customerPhone={customerPhone}
        customerAddress={customerAddress}
        deliveryType={deliveryType}
        paymentMethod={paymentMethod}
        items={items}
        subtotal={calculatedSubtotal}
        deliveryFee={calculatedDeliveryFee}
        discount={discount}
        total={total}
      />
    </>
  );
}
