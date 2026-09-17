'use client';

import { useState, useEffect } from 'react';
import { useAdminData } from '@/context/AdminDataContext';

type WriteReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string, menuItemId: string, menuItemName: string, customerName: string) => void;
  orderNumber: string;
  orderItems: { name: string; quantity: number }[];
  alreadyReviewed: boolean;
};

export function WriteReviewModal({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  orderItems,
  alreadyReviewed,
}: WriteReviewModalProps) {
  const { menuItems } = useAdminData();
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [customerName, setCustomerName] = useState('Satisfied Customer');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedItemIndex(0);
      setRating(0);
      setComment('');
      setShowSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const ratingLabels: Record<number, string> = {
    1: 'Poor 😞',
    2: 'Fair 😐',
    3: 'Good 🙂',
    4: 'Very Good 😊',
    5: 'Excellent! 🤩',
  };

  const currentItem = orderItems[selectedItemIndex] || orderItems[0] || { name: 'Menu Item' };

  // Match menu item ID from AdminDataContext by name or generate fallback ID
  const matchedMenuItem = menuItems.find(
    (mi) => mi.name.toLowerCase() === currentItem.name.toLowerCase()
  );
  const menuItemId = matchedMenuItem ? matchedMenuItem.id : `mi-order-${currentItem.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  const handleSubmit = () => {
    if (rating === 0 || alreadyReviewed) return;
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit(
        rating,
        comment.trim(),
        menuItemId,
        currentItem.name,
        customerName.trim() || 'Satisfied Customer'
      );
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setRating(0);
        setComment('');
        onClose();
      }, 1500);
    }, 400);
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    setShowSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-md bg-[#FFF8F0] rounded-3xl border border-amber-200/80 shadow-2xl overflow-hidden">
        {/* Success Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 z-20 bg-[#FFF8F0]/95 flex flex-col items-center justify-center gap-3 rounded-3xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-black text-[#451a03]">Review Submitted!</p>
            <p className="text-xs text-stone-600">Thank you for your feedback</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-[#B91C1C] to-red-700 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">Write a Review</h2>
              <p className="text-xs text-red-100/90 mt-0.5 font-semibold">Order #{orderNumber}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Order Item Selection */}
          <div>
            <label className="block text-xs font-black text-stone-500 uppercase tracking-wider mb-1.5">
              Select Item to Review
            </label>
            {orderItems.length > 1 ? (
              <select
                value={selectedItemIndex}
                onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
              >
                {orderItems.map((item, idx) => (
                  <option key={idx} value={idx}>
                    {item.name} (×{item.quantity})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-white rounded-xl border border-amber-200/80 p-3">
                <p className="text-xs font-bold text-[#451a03]">{currentItem.name}</p>
              </div>
            )}
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-black text-stone-500 uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3.5 py-2 bg-white border border-amber-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
            />
          </div>

          {/* Star Rating */}
          <div className="text-center space-y-2 pt-1">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wider">How was your experience?</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-125 active:scale-95"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <svg
                    className={`w-9 h-9 transition-colors duration-150 ${
                      star <= (hoveredStar || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-stone-200 text-stone-200'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            {(hoveredStar || rating) > 0 && (
              <p className="text-sm font-extrabold text-[#451a03]">{ratingLabels[hoveredStar || rating]}</p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-black text-stone-500 uppercase tracking-wider mb-1.5">
              Your Comment <span className="text-stone-400 normal-case font-semibold">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience at Eat n' RepEat..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-2xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/30 focus:border-[#B91C1C] transition resize-none"
            />
            <p className="text-right text-[10px] text-stone-400 mt-0.5">{comment.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting || alreadyReviewed}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs shadow-md transition-all ${
                rating === 0 || isSubmitting || alreadyReviewed
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : 'bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </span>
              ) : alreadyReviewed ? (
                '✓ Already Reviewed'
              ) : (
                'Submit Review'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
