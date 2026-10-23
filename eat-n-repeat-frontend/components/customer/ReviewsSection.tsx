'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useReviews } from '@/context/ReviewsContext';
import type { ServerReview } from '@/lib/customer/review-types';
import { MessageSquare } from 'lucide-react';

type ReviewsSectionProps = {
  menuItemId: string;
  maxReviews?: number;
};

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function getCustomerInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0];
}

function Stars({ value, size }: { value: number; size: 'sm' | 'xs' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  return (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`${cls} ${
            i < value ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function OwnReviewEditor({
  review,
  onDone,
}: {
  review: ServerReview;
  onDone: () => void;
}) {
  const { updateReview, deleteReview } = useReviews();
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving || rating < 1) return;
    setSaving(true);
    setError(null);
    try {
      await updateReview(review.id, { rating, comment });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm('Delete your review for this item?')) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReview(review.id);
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not delete your review.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-2 pl-9 space-y-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            aria-label={`Rate ${star} stars`}
            className="p-0.5"
          >
            <svg
              className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#B91C1C] resize-none"
      />
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-50 text-white rounded-lg text-[11px] font-black transition"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 rounded-lg text-[11px] font-black transition"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-[11px] font-bold transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ReviewsSection({ menuItemId, maxReviews = 5 }: ReviewsSectionProps) {
  const { getReviewsByMenuItem, getAverageRating, getMyReviewForItem, refreshItem } =
    useReviews();
  const { data: session } = useSession();
  const [editingOwn, setEditingOwn] = useState(false);

  useEffect(() => {
    refreshItem(menuItemId);
  }, [menuItemId, refreshItem, (session as any)?.accessToken]);

  const reviews = getReviewsByMenuItem(menuItemId);
  const { averageRating, totalReviews } = getAverageRating(menuItemId);
  const myReview = getMyReviewForItem(menuItemId);

  if (totalReviews === 0) {
    return (
      <div className="mt-6 p-5 bg-[#FFF9F2] rounded-2xl border border-amber-200/60">
        <h3 className="text-sm font-black text-[#451a03] mb-2">Customer Reviews</h3>
        <div className="text-center py-6">
          <div className="mb-2"><MessageSquare className="w-8 h-8 text-stone-400 mx-auto" /></div>
          <p className="text-xs font-bold text-stone-500">No reviews yet</p>
          <p className="text-[11px] text-stone-400 mt-0.5">Be the first to review this item!</p>
        </div>
      </div>
    );
  }

  // Own review first so the customer always finds it, then everyone else's.
  const ordered = [...reviews].sort((a, b) => {
    if (a.isMine && !b.isMine) return -1;
    if (!a.isMine && b.isMine) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const displayedReviews = ordered.slice(0, maxReviews);

  return (
    <div className="mt-6 p-5 bg-[#FFF9F2] rounded-2xl border border-amber-200/60">
      {/* Header with the GLOBAL average rating (backend-rounded, as-is) */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-amber-200/50">
        <h3 className="text-sm font-black text-[#451a03]">Customer Reviews</h3>
        <div className="flex items-center gap-2">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < Math.floor(averageRating) ? 'fill-amber-400' : 'fill-stone-200'
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-xs font-extrabold text-[#451a03]">{averageRating.toFixed(1)}</span>
          <span className="text-[11px] text-stone-400">({totalReviews})</span>
        </div>
      </div>

      {/* Reviews List — every customer's comment, not just your own */}
      <div className="space-y-3">
        {displayedReviews.map((review) => {
          const isOwn = review.isMine || myReview?.id === review.id;
          return (
            <div
              key={review.id}
              className="bg-white rounded-xl p-3.5 border border-amber-100/80 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  {/* Avatar Circle */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-[#B91C1C] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-white">
                      {review.customerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#451a03] flex items-center gap-1.5">
                      {getCustomerInitials(review.customerName)}
                      {isOwn && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                          Your review
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1">
                      <Stars value={review.rating} size="xs" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-stone-400 font-semibold">
                    {formatRelativeDate(review.createdAt)}
                  </span>
                  {isOwn && !editingOwn && (
                    <button
                      type="button"
                      onClick={() => setEditingOwn(true)}
                      className="text-[10px] font-black text-[#B91C1C] hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {review.comment && (
                <p className="text-xs text-stone-600 leading-relaxed mt-1 pl-9">
                  {review.comment}
                </p>
              )}
              {isOwn && editingOwn && myReview && review.id === myReview.id && (
                <OwnReviewEditor review={review} onDone={() => setEditingOwn(false)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {ordered.length > maxReviews && (
        <div className="text-center mt-3 pt-3 border-t border-amber-100/60">
          <p className="text-[11px] font-bold text-[#B91C1C]">
            +{ordered.length - maxReviews} more reviews
          </p>
        </div>
      )}
    </div>
  );
}
