'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import type {
  AdminReviewsResponse,
  MenuItemRatingSummary,
  MyServerReview,
  ServerReview,
} from '@/lib/customer/review-types';
import {
  createServerReview,
  deleteServerReview,
  fetchAdminReviews,
  fetchItemReviews,
  fetchMenuAggregates,
  fetchMyReviews,
  setReviewVisibility,
  updateServerReview,
} from '@/lib/customer/reviews-api';
import { getStaffOrAdminToken } from '@/lib/admin/auth-token';

const STORAGE_KEY = 'eat-n-repeat-reviews-v2';

type ItemCache = {
  reviews: ServerReview[];
  myReview: ServerReview | null;
  myRating: number | null;
  hasReviewed: boolean;
  averageRating: number;
  ratingCount: number;
  total: number;
};

type AdminState = {
  reviews: AdminReviewsResponse['reviews'];
  pagination: AdminReviewsResponse['pagination'] | null;
  stats: AdminReviewsResponse['stats'] | null;
};

type ReviewsContextValue = {
  // Sync getters backed by the server cache (never locally computed).
  getReviewsByMenuItem: (menuItemId: string) => ServerReview[];
  getAverageRating: (menuItemId: string) => MenuItemRatingSummary;
  hasReviewedOrder: (orderId: string) => boolean;
  getAllReviews: () => ServerReview[];
  getMyReviewForItem: (menuItemId: string) => ServerReview | null;
  myReviews: MyServerReview[];
  // Mutations (server round-trip, caches updated from the response aggregate).
  addReview: (input: {
    orderId: string;
    menuItemId: string;
    menuItemName: string;
    rating: number;
    comment: string;
  }) => Promise<void>;
  updateReview: (id: string, patch: { rating?: number; comment?: string }) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  hideReview: (id: string) => Promise<void>;
  unhideReview: (id: string) => Promise<void>;
  refreshItem: (menuItemId: string) => Promise<void>;
  refreshSummaries: () => Promise<void>;
  // Admin moderation list (server-paginated).
  adminState: AdminState;
  fetchAdminPage: (params?: {
    rating?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  adminLoading: boolean;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

function toSummaryCache(
  aggregates: Record<string, { averageRating: number; ratingCount: number }>,
): Record<string, MenuItemRatingSummary> {
  const out: Record<string, MenuItemRatingSummary> = {};
  for (const [id, agg] of Object.entries(aggregates)) {
    out[id] = {
      averageRating: Number(agg.averageRating) || 0,
      totalReviews: Number(agg.ratingCount) || 0,
    };
  }
  return out;
}

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token = ((session as any)?.accessToken as string | undefined) ?? null;
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const [summaries, setSummaries] = useState<Record<string, MenuItemRatingSummary>>({});
  const [itemCaches, setItemCaches] = useState<Record<string, ItemCache>>({});
  // Ref mirror for the realtime effect (mount-once connection reads the
  // latest caches without re-subscribing on every state change).
  const itemCachesRef = useRef<Record<string, ItemCache>>({});
  itemCachesRef.current = itemCaches;
  const [myReviews, setMyReviews] = useState<MyServerReview[]>([]);
  const [adminState, setAdminState] = useState<AdminState>({
    reviews: [],
    pagination: null,
    stats: null,
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const hydratedFromStorage = useRef(false);

  // Offline fallback: last server snapshot (v2 key only — the legacy v1 key
  // with mock seed reviews is deliberately never read).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        summaries?: Record<string, MenuItemRatingSummary>;
        myReviews?: MyServerReview[];
      };
      if (parsed.summaries) setSummaries(parsed.summaries);
      if (Array.isArray(parsed.myReviews)) setMyReviews(parsed.myReviews);
    } catch {
      // Corrupt snapshot — start empty, server repopulates when reachable.
    } finally {
      hydratedFromStorage.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedFromStorage.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ summaries, myReviews }));
    } catch {
      // Quota or private mode — server remains source of truth.
    }
  }, [summaries, myReviews]);

  const refreshSummaries = useCallback(async () => {
    try {
      const aggregates = await fetchMenuAggregates(tokenRef.current);
      setSummaries(toSummaryCache(aggregates));
    } catch {
      // Backend unreachable — keep the last snapshot (offline mode).
    }
  }, []);

  const refreshMine = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) {
      setMyReviews([]);
      return;
    }
    try {
      const data = await fetchMyReviews(t);
      setMyReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch {
      // Offline — keep the last snapshot.
    }
  }, []);

  useEffect(() => {
    refreshSummaries();
    refreshMine();
  }, [refreshSummaries, refreshMine, token]);

  // ---- Realtime review updates (Phase 2) ---------------------------------
  // One shared public EventSource for the whole portal (guests included —
  // the stream carries only public rating data). Pattern mirrors
  // CustomerOrderChat: single connection per mount, 5s reconnect on error.
  // Preferred update strategy: NEVER apply the payload's review list
  // directly — refetch the affected item (avoids ordering/duplicate bugs;
  // the submitter's own client cannot double-add). The payload's
  // averageRating/ratingCount (server-rounded) update card summaries
  // immediately; the refetch then reconciles everything. myRating /
  // hasReviewed always come from the authenticated refetch, never the
  // broadcast. On (re)connect, refetch summaries + open items since missed
  // events are not replayed.
  // Ref mirrors for the realtime effect below (mount-once connection reads
  // the latest callbacks without re-subscribing on every render).
  // refreshItem is declared further below, so its ref starts empty and is
  // assigned right after its definition — the effect only runs post-mount.
  const refreshItemRef = useRef<((menuItemId: string) => Promise<void>) | null>(null);
  const refreshSummariesRef = useRef(refreshSummaries);
  refreshSummariesRef.current = refreshSummaries;

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshCachedItems = () => {
      const ids = Object.keys(itemCachesRef.current);
      for (const id of ids) refreshItemRef.current?.(id);
    };

    const connect = () => {
      if (cancelled || es) return;
      const next = new EventSource('/api/events/reviews/stream');
      es = next;

      next.onopen = () => {
        if (cancelled) return;
        // Initial connect + every reconnect: missed events are not
        // replayed, so refetch what is currently visible/cached.
        refreshSummariesRef.current();
        refreshCachedItems();
      };
      next.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          if (
            (data?.type === 'REVIEW_CREATED' ||
              data?.type === 'REVIEW_UPDATED' ||
              data?.type === 'REVIEW_DELETED') &&
            typeof data.menuItemId === 'string'
          ) {
            // Server-authoritative aggregate for instant card updates.
            if (
              typeof data.averageRating === 'number' &&
              typeof data.ratingCount === 'number'
            ) {
              setSummaries((prev) => ({
                ...prev,
                [data.menuItemId]: {
                  averageRating: data.averageRating,
                  totalReviews: data.ratingCount,
                },
              }));
            }
            // Full refetch for the open reviews list (no payload patching).
            if (itemCachesRef.current[data.menuItemId]) {
              refreshItemRef.current?.(data.menuItemId);
            }
          }
        } catch (error) {
          console.error('Failed to parse review SSE message:', error);
        }
      };
      next.onerror = () => {
        if (cancelled) return;
        try {
          next.close();
        } catch {
          // Ignore close errors during reconnect.
        }
        if (es === next) es = null;
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 5000);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        try {
          es.close();
        } catch {
          // Ignore close errors on unmount.
        }
        es = null;
      }
    };
  }, []);

  const refreshItem = useCallback(async (menuItemId: string) => {
    if (!menuItemId) return;
    try {
      const data = await fetchItemReviews(menuItemId, tokenRef.current);
      setItemCaches((prev) => ({
        ...prev,
        [menuItemId]: {
          reviews: data.reviews,
          myReview: data.myReview,
          myRating: data.myRating,
          hasReviewed: data.hasReviewed,
          averageRating: data.averageRating,
          ratingCount: data.ratingCount,
          total: data.pagination.total,
        },
      }));
      // The item response carries the authoritative aggregate — apply it to
      // the card-level summaries too (single source, no recompute).
      setSummaries((prev) => ({
        ...prev,
        [menuItemId]: {
          averageRating: data.averageRating,
          totalReviews: data.ratingCount,
        },
      }));
    } catch {
      // Offline — keep cached data.
    }
  }, []);

  // Late assignment for the realtime effect's ref (see above).
  refreshItemRef.current = refreshItem;

  const applyAggregate = useCallback(
    (menuItemId: string, averageRating: number, ratingCount: number) => {
      setSummaries((prev) => ({
        ...prev,
        [menuItemId]: { averageRating, totalReviews: ratingCount },
      }));
      setItemCaches((prev) => {
        const existing = prev[menuItemId];
        if (!existing) return prev;
        return {
          ...prev,
          [menuItemId]: { ...existing, averageRating, ratingCount },
        };
      });
    },
    [],
  );

  const addReview = useCallback(
    async (input: {
      orderId: string;
      menuItemId: string;
      menuItemName: string;
      rating: number;
      comment: string;
    }) => {
      const t = tokenRef.current;
      if (!t) throw new Error('Please sign in to write a review.');
      const result = await createServerReview(t, {
        menuItemId: input.menuItemId,
        rating: input.rating,
        comment: input.comment,
        orderId: input.orderId,
      });
      applyAggregate(input.menuItemId, result.averageRating, result.ratingCount);
      await refreshMine();
      await refreshItem(input.menuItemId);
    },
    [applyAggregate, refreshItem, refreshMine],
  );

  const updateReview = useCallback(
    async (id: string, patch: { rating?: number; comment?: string }) => {
      const t = tokenRef.current;
      if (!t) throw new Error('Please sign in to edit your review.');
      // Find the item so caches can be refreshed after the write.
      let menuItemId: string | null = null;
      for (const cache of Object.values(itemCaches)) {
        if (cache.reviews.some((r) => r.id === id) || cache.myReview?.id === id) {
          menuItemId = cache.myReview?.menuItemId ?? cache.reviews.find((r) => r.id === id)?.menuItemId ?? null;
          break;
        }
      }
      const mineHit = myReviews.find((r) => r.id === id);
      if (!menuItemId && mineHit) menuItemId = mineHit.menuItemId;
      const result = await updateServerReview(t, id, patch);
      const itemId = menuItemId ?? (result.review as ServerReview).menuItemId;
      applyAggregate(itemId, result.averageRating, result.ratingCount);
      await refreshMine();
      await refreshItem(itemId);
    },
    [applyAggregate, itemCaches, myReviews, refreshItem, refreshMine],
  );

  const deleteReview = useCallback(
    async (id: string) => {
      const t = tokenRef.current;
      if (!t) throw new Error('Please sign in to delete your review.');
      let menuItemId: string | null = null;
      for (const cache of Object.values(itemCaches)) {
        const hit =
          cache.reviews.find((r) => r.id === id) ??
          (cache.myReview?.id === id ? cache.myReview : undefined);
        if (hit) {
          menuItemId = hit.menuItemId;
          break;
        }
      }
      const mineHit = myReviews.find((r) => r.id === id);
      if (!menuItemId && mineHit) menuItemId = mineHit.menuItemId;
      // Optimistic removal so the author's own client never shows a duplicate
      // or a ghost row while the refetch below completes.
      if (menuItemId) {
        const target = menuItemId;
        setItemCaches((prev) => {
          const existing = prev[target];
          if (!existing) return prev;
          return {
            ...prev,
            [target]: {
              ...existing,
              reviews: existing.reviews.filter((r) => r.id !== id),
              myReview: existing.myReview?.id === id ? null : existing.myReview,
              myRating: existing.myReview?.id === id ? null : existing.myRating,
              hasReviewed: existing.myReview?.id === id ? false : existing.hasReviewed,
            },
          };
        });
      }
      const result = await deleteServerReview(t, id);
      const itemId = menuItemId ?? result.menuItemId;
      applyAggregate(itemId, result.averageRating, result.ratingCount);
      await refreshMine();
      await refreshItem(itemId);
    },
    [applyAggregate, itemCaches, myReviews, refreshItem, refreshMine],
  );

  const hideReview = useCallback(
    async (id: string) => {
      const staffToken = getStaffOrAdminToken();
      if (!staffToken) throw new Error('Admin authorization required.');
      await setReviewVisibility(staffToken, id, true);
      await refreshSummaries();
    },
    [refreshSummaries],
  );

  const unhideReview = useCallback(
    async (id: string) => {
      const staffToken = getStaffOrAdminToken();
      if (!staffToken) throw new Error('Admin authorization required.');
      await setReviewVisibility(staffToken, id, false);
      await refreshSummaries();
    },
    [refreshSummaries],
  );

  const fetchAdminPage = useCallback(
    async (params?: {
      rating?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      const staffToken = getStaffOrAdminToken();
      if (!staffToken) {
        setAdminState({ reviews: [], pagination: null, stats: null });
        return;
      }
      setAdminLoading(true);
      try {
        const data = await fetchAdminReviews(staffToken, params);
        setAdminState({
          reviews: data.reviews,
          pagination: data.pagination,
          stats: data.stats,
        });
      } catch {
        // Offline — keep the previous page.
      } finally {
        setAdminLoading(false);
      }
    },
    [],
  );

  const getReviewsByMenuItem = useCallback(
    (menuItemId: string): ServerReview[] => {
      return itemCaches[menuItemId]?.reviews ?? [];
    },
    [itemCaches],
  );  const getAverageRating = useCallback(
    (menuItemId: string): MenuItemRatingSummary => {
      const cached = itemCaches[menuItemId];
      if (cached) {
        return { averageRating: cached.averageRating, totalReviews: cached.ratingCount };
      }
      return summaries[menuItemId] ?? { averageRating: 0, totalReviews: 0 };
    },
    [itemCaches, summaries],
  );

  // Duplicate-review / already-reviewed gate. Backend stores the originating
  // orderId, so a delivered order maps to its review; a customer-level
  // fallback covers reviews whose order link is absent.
  const hasReviewedOrder = useCallback(
    (orderId: string) => {
      if (!orderId) return false;
      return myReviews.some((r) => r.orderId === orderId);
    },
    [myReviews],
  );

  const getAllReviews = useCallback((): ServerReview[] => {
    const merged = new Map<string, ServerReview>();
    for (const cache of Object.values(itemCaches)) {
      for (const r of cache.reviews) merged.set(r.id, r);
      if (cache.myReview && !merged.has(cache.myReview.id)) {
        merged.set(cache.myReview.id, cache.myReview);
      }
    }
    return [...merged.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [itemCaches]);

  const getMyReviewForItem = useCallback(
    (menuItemId: string): ServerReview | null => {
      return (
        itemCaches[menuItemId]?.myReview ??
        myReviews.find((r) => r.menuItemId === menuItemId && !r.hidden) ??
        null
      );
    },
    [itemCaches, myReviews],
  );

  const value = useMemo<ReviewsContextValue>(
    () => ({
      getReviewsByMenuItem,
      getAverageRating,
      hasReviewedOrder,
      getAllReviews,
      getMyReviewForItem,
      myReviews,
      addReview,
      updateReview,
      deleteReview,
      hideReview,
      unhideReview,
      refreshItem,
      refreshSummaries,
      adminState,
      fetchAdminPage,
      adminLoading,
    }),
    [
      getReviewsByMenuItem,
      getAverageRating,
      hasReviewedOrder,
      getAllReviews,
      getMyReviewForItem,
      myReviews,
      addReview,
      updateReview,
      deleteReview,
      hideReview,
      unhideReview,
      refreshItem,
      refreshSummaries,
      adminState,
      fetchAdminPage,
      adminLoading,
    ],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return ctx;
}
