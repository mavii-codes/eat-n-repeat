'use client';

import { useState, useMemo } from 'react';
import { useReviews } from '@/context/ReviewsContext';
import { Star, MessageSquare } from 'lucide-react';

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StaffReviewsView() {
  const { getAllReviews } = useReviews();
  const allReviews = getAllReviews();

  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleReviews = useMemo(() => {
    return allReviews.filter((r) => !r.hidden);
  }, [allReviews]);

  const filteredReviews = useMemo(() => {
    return visibleReviews.filter((r) => {
      if (ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.customerName.toLowerCase().includes(q) ||
          r.menuItemName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visibleReviews, ratingFilter, searchQuery]);

  const stats = useMemo(() => {
    if (visibleReviews.length === 0) {
      return { total: 0, averageRating: 0, fiveStarPct: 0 };
    }
    const sum = visibleReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / visibleReviews.length) * 10) / 10;
    const fiveStars = visibleReviews.filter((r) => r.rating === 5).length;
    const fiveStarPct = Math.round((fiveStars / visibleReviews.length) * 100);
    return {
      total: visibleReviews.length,
      averageRating: avg,
      fiveStarPct,
    };
  }, [visibleReviews]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/80 bg-white/85 px-6 py-5 shadow-sm backdrop-blur-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.28em] text-[#B91C1C]">
            Customer Feedback &amp; Ratings
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#451a03]">
            Customer Reviews
          </h1>
          <p className="mt-1 text-xs text-stone-600">
            Real customer ratings and feedback for Eat n&apos; RepEat menu items.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
              Average Rating
            </span>
            <span className="text-xl font-black text-amber-600 flex items-center gap-1 justify-end">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" /> {stats.averageRating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-stone-200/80 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Customer Reviews</p>
          <p className="text-2xl font-black text-[#451a03] mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200/80 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Average Star Score</p>
          <p className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1"><Star className="w-5 h-5 fill-amber-500 text-amber-500" /> {stats.averageRating.toFixed(1)} / 5.0</p>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200/80 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">5-Star Satisfaction Rate</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.fiveStarPct}%</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search reviews by customer, item, or comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20"
          />
        </div>

        {/* Rating Filter */}
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
          className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20"
        >
          <option value="all">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-white border border-dashed border-amber-300 p-8">
          <div className="mb-2"><MessageSquare className="w-10 h-10 text-stone-400 mx-auto" /></div>
          <p className="text-sm font-bold text-stone-700">No reviews matching filters</p>
          <p className="text-xs text-stone-400 mt-1">Try selecting a different rating or search term.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-2xs transition-all hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-[#B91C1C] flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-white">
                        {review.customerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#451a03]">{review.customerName}</p>
                      <p className="text-[11px] text-stone-500 font-semibold">{review.menuItemName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-[11px] text-stone-400 font-semibold">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>

                  {review.comment ? (
                    <p className="text-xs text-stone-700 leading-relaxed font-medium">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400 italic">No written comment provided</p>
                  )}
                </div>

                <div className="shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 text-right">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Rating</span>
                  <span className="text-xs font-black text-[#451a03]">{review.rating} / 5 Stars</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
