'use client';

import { useReviews } from '@/context/ReviewsContext';
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

export function ReviewsSection({ menuItemId, maxReviews = 5 }: ReviewsSectionProps) {
  const { getReviewsByMenuItem, getAverageRating } = useReviews();
  const reviews = getReviewsByMenuItem(menuItemId);
  const { averageRating, totalReviews } = getAverageRating(menuItemId);

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

  const displayedReviews = reviews.slice(0, maxReviews);

  return (
    <div className="mt-6 p-5 bg-[#FFF9F2] rounded-2xl border border-amber-200/60">
      {/* Header with average rating */}
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

      {/* Reviews List */}
      <div className="space-y-3">
        {displayedReviews.map((review) => (
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
                  <p className="text-xs font-bold text-[#451a03]">{getCustomerInitials(review.customerName)}</p>
                  <div className="flex items-center gap-1">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-2.5 h-2.5 ${
                            i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-stone-400 font-semibold shrink-0">
                {formatRelativeDate(review.createdAt)}
              </span>
            </div>
            {review.comment && (
              <p className="text-xs text-stone-600 leading-relaxed mt-1 pl-9">
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Show more indicator */}
      {reviews.length > maxReviews && (
        <div className="text-center mt-3 pt-3 border-t border-amber-100/60">
          <p className="text-[11px] font-bold text-[#B91C1C]">
            +{reviews.length - maxReviews} more reviews
          </p>
        </div>
      )}
    </div>
  );
}
