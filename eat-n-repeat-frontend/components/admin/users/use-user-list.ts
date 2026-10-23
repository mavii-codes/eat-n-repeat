"use client";

/* Small paging-fetch hook for the User Management tabs. Pages own their
   loading state (same pattern as fetchStockMovementsPage in
   AdminDataContext) — this only re-renders on real list changes. Data stays
   visible during a refetch (filter change / manual refresh) so the panel
   never flickers to blank. */

import { useEffect, useRef, useState } from "react";
import type { ApiResult } from "./api";
import type { Page, UserListQuery } from "./types";

type ListFetcher<T> = (
  query: UserListQuery,
) => Promise<ApiResult<Page<T>>>;

export function useUserList<T>(
  fetcher: ListFetcher<T>,
  query: UserListQuery,
) {
  // The query object is serialized so referential identity never matters;
  // fetchers are kept in a ref the same way AdminDataContext keeps
  // callbacks stable across renders.
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
        JSON.parse(queryKey) as UserListQuery,
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
