"use client";

/* Promo Codes — API access for /api/admin/promos/*.
   Auth: the admin bearer token via getStaffOrAdminToken. No new auth
   mechanism; same forced-password-change redirect behavior as the users
   module.

   Behavior notes:
   - Responses are never trusted blindly; rows are normalized defensively.
   - Backend messages (409 duplicate code, 402 used-code locks, 409 used-code
     delete) travel VERBATIM to the confirmation dialog / form / toast. */

import { getApiUrl } from "@/lib/config";
import {
  getStaffOrAdminToken,
  isMustChangePasswordBody,
} from "@/lib/admin/auth-token";
import type { Page, PromoListQuery, PromoRow, RedemptionRow } from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

const READ_TIMEOUT_MS = 12000;
const WRITE_TIMEOUT_MS = 20000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function gotForcedPasswordChange(body: unknown): boolean {
  if (!isMustChangePasswordBody(body)) return false;
  if (typeof window !== "undefined") {
    window.location.assign("/change-password");
  }
  return true;
}

function serverMessage(body: unknown): string | null {
  const message = (body as { message?: unknown; error?: unknown } | null)
    ?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function serverError(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

/* Any server-provided message, `message` first then GatewayStyle `error`. */
function anyServerText(body: unknown): string | null {
  return serverMessage(body) ?? serverError(body);
}

type PagedBody<T> = { rows?: unknown; total?: unknown };

async function parsePaged<T>(
  res: Response,
  fallbackTitle: string,
): Promise<ApiResult<Page<T>>> {
  if (res.status === 401) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  const body = (await res.json().catch(() => null)) as
    | (PagedBody<T> & { message?: unknown; code?: unknown })
    | null;
  if (res.status === 403) {
    if (gotForcedPasswordChange(body)) {
      return { ok: false, message: "Password change required." };
    }
    return { ok: false, message: anyServerText(body) ?? "Admin authorization required." };
  }
  if (!res.ok) {
    return {
      ok: false,
      message: anyServerText(body) ?? `Could not load the ${fallbackTitle}.`,
    };
  }
  const rows = Array.isArray(body?.rows) ? body!.rows : [];
  const totalRaw = Number(body?.total);
  return {
    ok: true,
    data: {
      rows: rows as T[],
      total: Number.isFinite(totalRaw) ? totalRaw : rows.length,
    },
  };
}

/* ── Query builders — blank/default values are omitted, not sent empty. ── */

function buildListQuery(query: PromoListQuery): string {
  const q = new URLSearchParams();
  q.set("page", String(Math.max(1, Math.floor(query.page) || 1)));
  q.set("limit", String(Math.max(1, Math.min(100, Math.floor(query.limit || 20)))));
  const search = (query.search ?? "").trim();
  if (search) q.set("search", search);
  const status = (query.status ?? "all").trim();
  if (status && status !== "all") q.set("status", status);
  const sort = (query.sort ?? "").trim();
  if (sort) q.set("sort", sort);
  if (query.dir) q.set("dir", query.dir === "desc" ? "desc" : "asc");
  return q.toString();
}

/* Rich drill-downs page one code's history (small sets; plain JSON arrays). */
async function parsePlainList<T>(
  res: Response,
  fallbackTitle: string,
): Promise<ApiResult<{ rows: T[]; total: number }>> {
  if (res.status === 401) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  const body = (await res.json().catch(() => null)) as
    | { message?: unknown; code?: unknown; rows?: unknown; total?: unknown }
    | null;
  if (res.status === 403) {
    if (gotForcedPasswordChange(body)) {
      return { ok: false, message: "Password change required." };
    }
    return { ok: false, message: anyServerText(body) ?? "Admin authorization required." };
  }
  if (res.status === 404) {
    return {
      ok: false,
      message: anyServerText(body) ?? "Promo not found.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      message: anyServerText(body) ?? `Could not load the ${fallbackTitle}.`,
    };
  }
  if (Array.isArray(body as unknown)) {
    const rows = body as unknown as T[];
    return { ok: true, data: { rows, total: rows.length } };
  }
  const rows = Array.isArray(body?.rows) ? body!.rows : [];
  const totalRaw = Number(body?.total);
  return {
    ok: true,
    data: { rows: rows as T[], total: Number.isFinite(totalRaw) ? totalRaw : rows.length },
  };
}

/* ── List reads ────────────────────────────────────────────────────────── */

export async function fetchPromoPage(
  query: PromoListQuery,
): Promise<ApiResult<Page<PromoRow>>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos?${buildListQuery(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePaged<PromoRow>(res, "promo list");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function fetchRedemptions(
  promoId: string,
): Promise<ApiResult<{ rows: RedemptionRow[]; total: number }>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos/${encodeURIComponent(promoId)}/redemptions`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePlainList<RedemptionRow>(res, "redemption history");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/* ── Actions ─────────────────────────────────────────────────────────────
   Every failure message travels VERBATIM — the 409 "This code already
   exists", the 402 "This code has been used and its type or value can't be
   changed. Create a new code instead." and the 409 "This code has been used
   and can't be deleted. Pause it instead." reach the admin word for word. */

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function parseAction(
  res: Response,
  failureTitle: string,
): Promise<ActionResult> {
  const body = (await res.json().catch(() => null)) as
    | { message?: unknown; error?: unknown; code?: unknown }
    | null;
  if (res.status === 401) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  if (res.status === 403 && gotForcedPasswordChange(body)) {
    return { ok: false, message: "Password change required." };
  }
  if (!res.ok) {
    return { ok: false, message: anyServerText(body) ?? failureTitle };
  }
  return {
    ok: true,
    ...(anyServerText(body) ? { message: anyServerText(body)! } : {}),
  };
}

function authedHeaders(withJson: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getStaffOrAdminToken() ?? ""}`,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

export async function createPromo(
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos`,
      {
        method: "POST",
        headers: authedHeaders(true),
        body: JSON.stringify(payload),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "Could not create the promo.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function updatePromo(
  promoId: string,
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos/${encodeURIComponent(promoId)}`,
      {
        method: "PATCH",
        headers: authedHeaders(true),
        body: JSON.stringify(payload),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "Could not update the promo.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function pausePromo(promoId: string): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos/${encodeURIComponent(promoId)}/pause`,
      { method: "POST", headers: authedHeaders(false) },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "Could not pause the promo.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function activatePromo(promoId: string): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos/${encodeURIComponent(promoId)}/activate`,
      { method: "POST", headers: authedHeaders(false) },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "Could not activate the promo.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function deletePromo(promoId: string): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/promos/${encodeURIComponent(promoId)}/delete`,
      { method: "POST", headers: authedHeaders(false) },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "Could not delete the promo.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}
