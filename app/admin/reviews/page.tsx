'use client';

import { useState, useMemo } from 'react';
import { useReviews } from '@/context/ReviewsContext';
import { useAdminData } from '@/context/AdminDataContext';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminButton, AdminPanel } from '@/components/admin/AdminForm';
import { Search, EyeOff, Trash2, Eye } from 'lucide-react';

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1';
type StatusFilter = 'all' | 'visible' | 'hidden';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminReviewsPage() {
  const { getAllReviews, hideReview, unhideReview, deleteReview } = useReviews();
  const { menuItems } = useAdminData();
  const allReviews = getAllReviews();

  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [confirmHideId, setConfirmHideId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredReviews = useMemo(() => {
    return allReviews.filter((r) => {
      if (ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      if (statusFilter === 'visible' && r.hidden) return false;
      if (statusFilter === 'hidden' && !r.hidden) return false;
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
  }, [allReviews, ratingFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const visible = allReviews.filter((r) => !r.hidden);
    const avgRating = visible.length > 0
      ? Math.round((visible.reduce((sum, r) => sum + r.rating, 0) / visible.length) * 10) / 10
      : 0;
    
    // Calculate rating distribution (including hidden? Usually yes for total overview, or only visible? Let's use visible for true average)
    // Actually, let's use all reviews for distribution so admin sees everything, but maybe visible only? The prompt says "Visible reviews: 14" out of 14, so it probably includes all in the distribution. Let's just use all reviews to show what customers rated.
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allReviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as keyof typeof distribution]++;
      }
    });

    return {
      total: allReviews.length,
      visible: visible.length,
      hidden: allReviews.length - visible.length,
      averageRating: avgRating,
      distribution
    };
  }, [allReviews]);

  // Top Rated Menu Items (calculated dynamically)
  const topRatedItems = useMemo(() => {
    const itemStats: Record<string, { totalRating: number, count: number, name: string }> = {};
    const visibleReviews = allReviews.filter(r => !r.hidden);
    
    visibleReviews.forEach(r => {
      if (!itemStats[r.menuItemId]) {
        itemStats[r.menuItemId] = { totalRating: 0, count: 0, name: r.menuItemName };
      }
      itemStats[r.menuItemId].totalRating += r.rating;
      itemStats[r.menuItemId].count += 1;
    });

    return Object.values(itemStats)
      .map(stat => ({
        name: stat.name,
        averageRating: Math.round((stat.totalRating / stat.count) * 10) / 10,
        reviewCount: stat.count
      }))
      .filter(item => item.reviewCount > 0)
      .sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount)
      .slice(0, 5); // Top 5
  }, [allReviews]);

  const handleHideToggle = (id: string, currentlyHidden: boolean) => {
    if (currentlyHidden) {
      unhideReview(id);
    } else {
      setConfirmHideId(id);
    }
  };

  const executeHide = () => {
    if (confirmHideId) {
      hideReview(confirmHideId);
      setConfirmHideId(null);
    }
  };

  const executeDelete = () => {
    if (confirmDeleteId) {
      deleteReview(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        badge="Feedback"
        title="Customer Reviews"
        subtitle="View and manage customer feedback, ratings, and menu performance."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="admin-stat-card rounded-2xl p-5 border-l-4 border-l-[#800000]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Reviews</p>
          <p className="text-3xl font-serif font-bold text-stone-900 mt-2">{stats.total}</p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 border-l-4 border-l-yellow-500">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Average Rating</p>
          <p className="text-3xl font-serif font-bold text-yellow-500 mt-2 flex items-center gap-2">
            ★ {stats.averageRating.toFixed(1)} <span className="text-lg text-stone-400">/ 5.0</span>
          </p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 border-l-4 border-l-emerald-500">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Visible Reviews</p>
          <p className="text-3xl font-serif font-bold text-stone-900 mt-2">{stats.visible}</p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 border-l-4 border-l-stone-400">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Hidden Reviews</p>
          <p className="text-3xl font-serif font-bold text-stone-900 mt-2">{stats.hidden}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Rating Overview */}
        <div className="lg:col-span-1">
          <AdminPanel title="Rating Overview" subtitle="Distribution of all reviews">
            <div className="p-5 space-y-3">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = stats.distribution[stars as keyof typeof stats.distribution];
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-sm">
                    <div className="w-16 flex text-yellow-500 font-bold shrink-0">
                      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                    </div>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-20 text-right text-stone-500 text-xs font-medium shrink-0">
                      {count} review{count !== 1 && 's'}
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminPanel>
        </div>

        {/* Top Rated Menu Items */}
        <div className="lg:col-span-2">
          <AdminPanel title="Top Rated Menu Items" subtitle="Based on visible customer ratings">
            <div className="p-0">
              {topRatedItems.length > 0 ? (
                <ul className="divide-y divide-stone-100">
                  {topRatedItems.map((item, idx) => (
                    <li key={idx} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-stone-50 transition-colors">
                      <div className="font-semibold text-[#800000]">{item.name}</div>
                      <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="text-yellow-500 flex items-center gap-1">★ {item.averageRating.toFixed(1)}</span>
                        <span className="text-stone-400">{item.reviewCount} review{item.reviewCount !== 1 && 's'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-stone-400 text-sm">
                  No rated menu items yet.
                </div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] transition-colors shadow-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[130px] flex-1 sm:flex-none"
            >
              <option value="all">All Ratings</option>
              <option value="5">★ 5 Stars</option>
              <option value="4">★ 4 Stars</option>
              <option value="3">★ 3 Stars</option>
              <option value="2">★ 2 Stars</option>
              <option value="1">★ 1 Star</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[120px] flex-1 sm:flex-none"
            >
              <option value="all">All Status</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-200 shadow-sm">
            <div className="mb-3 opacity-50"><svg className="w-10 h-10 text-stone-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
            <p className="text-sm font-semibold text-stone-600">No reviews found</p>
            <p className="text-xs text-stone-400 mt-1">Adjust your filters or search query.</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all flex flex-col sm:flex-row gap-5 ${
                review.hidden ? 'border-stone-200 opacity-75' : 'border-[#800000]/10 hover:border-[#800000]/30'
              }`}
            >
              {/* Left Column (Details) */}
              <div className="flex-1">
                <div className="flex items-start justify-between sm:justify-start gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#800000]/5 flex items-center justify-center text-[#800000] font-bold text-sm shrink-0">
                      {review.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-800">{review.customerName}</h4>
                      <p className="text-xs font-semibold text-[#800000]">{review.menuItemName}</p>
                    </div>
                  </div>
                  <div className="sm:hidden">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      review.hidden ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-700'
                    }`}>
                      {review.hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 mb-2">
                  <div className="flex text-yellow-500 text-sm">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </div>
                  <span className="text-xs text-stone-400 font-medium">
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-stone-600 leading-relaxed italic">"{review.comment}"</p>
              </div>

              {/* Right Column (Actions) */}
              <div className="flex sm:flex-col justify-between sm:justify-center items-end sm:items-end gap-3 sm:border-l border-stone-100 sm:pl-5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 mt-3 sm:mt-0">
                <div className="hidden sm:block mb-auto">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    review.hidden ? 'bg-stone-100 text-stone-500 ring-1 ring-stone-200' : 'bg-green-100 text-green-700 ring-1 ring-green-200'
                  }`}>
                    {review.hidden ? 'Hidden' : 'Visible'}
                  </span>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleHideToggle(review.id, review.hidden)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                  >
                    {review.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {review.hidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(review.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hide Modal */}
      <AdminModal
        open={!!confirmHideId}
        title="Hide this review?"
        onClose={() => setConfirmHideId(null)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setConfirmHideId(null)}>
              Cancel
            </AdminButton>
            <div onClick={executeHide} className="cursor-pointer">
              <AdminButton>
                Hide Review
              </AdminButton>
            </div>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Hidden reviews will no longer appear on the customer-facing menu and will not be factored into the menu item's average rating.
        </p>
      </AdminModal>

      {/* Delete Modal */}
      <AdminModal
        open={!!confirmDeleteId}
        title="Delete this review permanently?"
        onClose={() => setConfirmDeleteId(null)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </AdminButton>
            <div onClick={executeDelete} className="cursor-pointer bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-medium transition-colors text-sm">
              Delete Review
            </div>
          </>
        }
      >
        <p className="text-sm text-red-600 font-medium">
          Deleted reviews cannot be recovered.
        </p>
      </AdminModal>
    </>
  );
}
