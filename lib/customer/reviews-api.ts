'use client';

import { getApiUrl } from '@/lib/config';
import type {
  AdminReviewsResponse,
  MyServerReview,
  ServerItemReviewsResponse,
} from './review-types';

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseOrThrow(res: Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status}).`;
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return data;
}

export async function fetchItemReviews(
  menuItemId: string,
  token?: string | null,
  page = 1,
  limit = 50,
): Promise<ServerItemReviewsResponse> {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    limit: String(Math.min(100, Math.max(1, limit))),
  });
  const res = await fetch(
    `${getApiUrl()}/api/reviews/item/${encodeURIComponent(menuItemId)}?${params}`,
    { headers: { ...authHeaders(token) } },
  );
  return (await parseOrThrow(res)) as ServerItemReviewsResponse;
}

export async function createServerReview(
  token: string,
  input: { menuItemId: string; rating: number; comment?: string; orderId?: string },
): Promise<{ review: any; averageRating: number; ratingCount: number }> {
  const res = await fetch(`${getApiUrl()}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return await parseOrThrow(res);
}

export async function updateServerReview(
  token: string,
  id: string,
  patch: { rating?: number; comment?: string },
): Promise<{ review: any; averageRating: number; ratingCount: number }> {
  const res = await fetch(`${getApiUrl()}/api/reviews/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(patch),
  });
  return await parseOrThrow(res);
}

export async function deleteServerReview(
  token: string,
  id: string,
): Promise<{ menuItemId: string; averageRating: number; ratingCount: number }> {
  const res = await fetch(`${getApiUrl()}/api/reviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) },
  });
  return await parseOrThrow(res);
}

export async function fetchMyReviews(token: string): Promise<{ reviews: MyServerReview[] }> {
  const res = await fetch(`${getApiUrl()}/api/reviews/mine`, {
    headers: { ...authHeaders(token) },
  });
  return (await parseOrThrow(res)) as { reviews: MyServerReview[] };
}

export async function fetchAdminReviews(
  staffToken: string,
  params: {
    rating?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<AdminReviewsResponse> {
  const query = new URLSearchParams({
    rating: params.rating ?? 'all',
    status: params.status ?? 'all',
    search: params.search ?? '',
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  const res = await fetch(`${getApiUrl()}/api/reviews?${query}`, {
    headers: { ...authHeaders(staffToken) },
  });
  return (await parseOrThrow(res)) as AdminReviewsResponse;
}

export async function setReviewVisibility(
  staffToken: string,
  id: string,
  hidden: boolean,
): Promise<{ averageRating: number; ratingCount: number }> {
  const res = await fetch(
    `${getApiUrl()}/api/reviews/${encodeURIComponent(id)}/visibility`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(staffToken) },
      body: JSON.stringify({ hidden }),
    },
  );
  return await parseOrThrow(res);
}

export type MenuAggregateMap = Record<
  string,
  { averageRating: number; ratingCount: number; myRating: number | null; hasReviewed: boolean }
>;

// Bulk aggregates for every menu card. The menu endpoint already returns the
// GLOBAL aggregate per item (plus myRating when authenticated) — one request
// seeds all cards without per-component calculation.
export async function fetchMenuAggregates(token?: string | null): Promise<MenuAggregateMap> {
  const res = await fetch(`${getApiUrl()}/api/menu/items`, {
    headers: { ...authHeaders(token) },
  });
  const data = await parseOrThrow(res);
  const items = Array.isArray(data?.items) ? data.items : [];
  const out: MenuAggregateMap = {};
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    out[item.id] = {
      averageRating: Number(item.averageRating) || 0,
      ratingCount: Number(item.ratingCount) || 0,
      myRating: typeof item.myRating === 'number' ? item.myRating : null,
      hasReviewed: item.hasReviewed === true,
    };
  }
  return out;
}
