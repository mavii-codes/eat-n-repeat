"use client";

/* Promo Codes — small fetch hook for the /admin/promos tabs. Same paging
   pattern as use-user-list: the page owns its loading state, data stays
   visible during a refetch, and the query object is serialized so
   referential identity never matters. */

import { useEffect, useRef, useState } from "react";
import type { ApiResult } from "./api";
import type { Page, PromoListQuery } from "./types";

type ListFetcher<T> = (
  query: PromoListQuery,
) => Promise<ApiResult<Page<T>>>;

export function usePromoList<T>(
  fetcher: ListFetcher<T>,
  query: PromoListQuery,
) {
  const queryKey = JSON.stringify(query);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetcherRef.current(
        JSON.parse(queryKey) as PromoListQuery,
      );
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [queryKey, refreshToken]);

  return {
    data,
    loading,
    error,
    /** Manual refresh from the toolbar button. */
    refresh: () => setRefreshToken((v) => v + 1),
  };
}
