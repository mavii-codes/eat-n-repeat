"use client";

/* User Management — API access for /api/admin/users/* plus the existing
   /api/admin/customers/:id/phone edit endpoint.

   Auth: the existing staff/admin bearer token via getStaffOrAdminToken
   (eat-n-repeat-staff-token / session). No new auth mechanism.

   Behavior notes:
   - Responses are never trusted blindly; payloads are normalized and the
     page renders graceful states when fields are missing.
   - A 403 with code MUST_CHANGE_PASSWORD (forced password change) routes
     the whole session to /change-password immediately. The token is kept
     because the change-password call itself needs it. */

import { getApiUrl } from "@/lib/config";
import {
  getStaffOrAdminToken,
  isMustChangePasswordBody,
} from "@/lib/admin/auth-token";
import type {
  ActivityRow,
  CustomerRow,
  FlagRow,
  Page,
  StaffRow,
  UserListQuery,
} from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

/* Reads get a longer timeout than normal fetches: the backend cold-starts on
   free hosting and a 3s default would render a false error banner. */
const READ_TIMEOUT_MS = 12000;
/* Writes (disable/enable/reset/password) wait even longer — exactly the same
   trade-off AdminDataContext already accepts for staff writes. */
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
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
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
    return {
      ok: false,
      message: serverMessage(body) ?? "Admin authorization required.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      message: serverMessage(body) ?? `Could not load the ${fallbackTitle}.`,
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

/* ── Query builders ───────────────────────────────────────────────────────
   Blank/default values are OMITTED instead of sent as empty strings — the
   list endpoints validate strictly, like /api/stock/movements. */

function appendPaged(q: URLSearchParams, query: UserListQuery) {
  q.set("page", String(Math.max(1, Math.floor(query.page) || 1)));
  q.set("limit", String(Math.max(1, Math.min(100, Math.floor(query.limit || 20)))));
  const search = (query.search ?? "").trim();
  if (search) q.set("search", search);
}

function buildStaffQuery(query: UserListQuery): string {
  const q = new URLSearchParams();
  appendPaged(q, query);
  const role = (query.role ?? "all").trim();
  if (role && role !== "all") q.set("role", role);
  const status = (query.status ?? "all").trim();
  if (status && status !== "all") q.set("status", status);
  q.set("sort", query.sort?.trim() || "name");
  q.set("dir", query.dir === "desc" ? "desc" : "asc");
  return q.toString();
}

function buildCustomerQuery(query: UserListQuery): string {
  const q = new URLSearchParams();
  appendPaged(q, query);
  const status = (query.status ?? "all").trim();
  if (status && status !== "all") q.set("status", status);
  q.set("sort", query.sort?.trim() || "name");
  q.set("dir", query.dir === "desc" ? "desc" : "asc");
  return q.toString();
}

function buildActivityQuery(query: UserListQuery): string {
  const q = new URLSearchParams();
  appendPaged(q, query);
  const action = (query.action ?? "").trim();
  if (action && action !== "all") q.set("action", action);
  const from = (query.from ?? "").trim();
  if (from) q.set("from", from);
  const to = (query.to ?? "").trim();
  if (to) q.set("to", to);
  return q.toString();
}

function buildFlagsQuery(query: UserListQuery): string {
  const q = new URLSearchParams();
  appendPaged(q, query);
  /* The flags endpoint reads the tab as `status` (open | dismissed | all)
     and the outcome filter as `outcome` (pending | approved | watching). */
  const flagStatus = (query.flagStatus ?? "open").trim();
  if (flagStatus && flagStatus !== "all") q.set("status", flagStatus);
  const outcome = (query.outcome ?? "all").trim();
  if (outcome && outcome !== "all") q.set("outcome", outcome);
  return q.toString();
}

/* ── List reads ─────────────────────────────────────────────────────────── */

export async function fetchStaffPage(
  query: UserListQuery,
): Promise<ApiResult<Page<StaffRow>>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/staff?${buildStaffQuery(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePaged<StaffRow>(res, "staff directory");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function fetchCustomersPage(
  query: UserListQuery,
): Promise<ApiResult<Page<CustomerRow>>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/customers?${buildCustomerQuery(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePaged<CustomerRow>(res, "customer list");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function fetchActivityPage(
  query: UserListQuery,
): Promise<ApiResult<Page<ActivityRow>>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/activity?${buildActivityQuery(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePaged<ActivityRow>(res, "activity log");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function fetchFlagsPage(
  query: UserListQuery,
): Promise<ApiResult<Page<FlagRow>>> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/flags?${buildFlagsQuery(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    return await parsePaged<FlagRow>(res, "flagged customers list");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/* Admin-only badge source: how many flags are still open for review. */
export async function fetchOpenFlagCount(): Promise<
  { ok: true; count: number } | { ok: false; message: string }
> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/flags/open-count`,
      { headers: { Authorization: `Bearer ${token}` } },
      READ_TIMEOUT_MS,
    );
    const body = (await res.json().catch(() => null)) as { count?: unknown } | null;
    if (res.status === 401) {
      return { ok: false, message: "Admin authorization required. Sign in again." };
    }
    if (res.status === 403 && gotForcedPasswordChange(body)) {
      return { ok: false, message: "Password change required." };
    }
    if (!res.ok) {
      return { ok: false, message: serverMessage(body) ?? "Could not load the flag count." };
    }
    const count = Number(body?.count);
    if (!Number.isFinite(count) || count < 0) return { ok: true, count: 0 };
    return { ok: true, count: Math.floor(count) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

/* ── Actions ────────────────────────────────────────────────────────────── */

export type ActionResult =
  | { ok: true; message?: string; tempPassword?: string }
  | { ok: false; message: string };

/* Backend errors (409: last admin / open shift) are returned VERBATIM so the
   confirmation dialog can surface the exact message, e.g.
   "Close the open shift first." */
async function parseAction(
  res: Response,
  failureTitle: string,
): Promise<ActionResult> {
  const body = (await res.json().catch(() => null)) as {
    message?: unknown;
    tempPassword?: unknown;
    code?: unknown;
  } | null;
  if (res.status === 401) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  if (res.status === 403 && gotForcedPasswordChange(body)) {
    return { ok: false, message: "Password change required." };
  }
  if (!res.ok) {
    return {
      ok: false,
      // 409 messages (open shift / last admin) must reach the admin word for
      // word — never paraphrase them.
      message: serverMessage(body) ?? `Could not ${failureTitle} the account.`,
    };
  }
  const tempPassword =
    typeof body?.tempPassword === "string" && body.tempPassword.trim()
      ? body.tempPassword
      : undefined;
  return {
    ok: true,
    ...(serverMessage(body) ? { message: serverMessage(body)! } : {}),
    ...(tempPassword ? { tempPassword } : {}),
  };
}

export async function staffAction(
  id: string,
  action: "disable" | "enable" | "reset-password",
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  const verb = action === "reset-password" ? "reset the password for" : action;
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/staff/${encodeURIComponent(id)}/${action}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, verb);
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/* ── Staff create / edit (Staff sub-page) ──────────────────────────────────
   Uses the long-standing admin-only /api/staff endpoints. Error messages
   travel VERBATIM so the dialog can show them word for word: the 409s
   ("Email already in use." / "Username already in use."), the 400 policy
   message, the 400 "Password is required for new accounts", and the 403
   "Creating admin accounts is not allowed." */

export type StaffWriteInput = {
  name: string;
  username: string;
  email: string;
  password?: string;
  role: string;
  status: string;
};

/** POST /api/staff — create a staff/head_staff/delivery_rider account. */
export async function createStaffPage(
  input: StaffWriteInput,
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/staff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "create");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/** PUT /api/staff/:id — edit name/username/email/role/status (edits never
 *  send a password; password resets go through the Reset action). */
export async function updateStaffPage(
  id: string,
  input: StaffWriteInput,
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/staff/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "update");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/** POST /api/staff/temp-password — one friendly temporary password for the
 *  Add-staff modal's "Generate" option. */
export async function fetchTempPassword(): Promise<
  { ok: true; tempPassword: string } | { ok: false; message: string }
> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/staff/temp-password`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      WRITE_TIMEOUT_MS,
    );
    const body = (await res.json().catch(() => null)) as {
      tempPassword?: unknown;
    } | null;
    if (res.status === 401) {
      return { ok: false, message: "Admin authorization required. Sign in again." };
    }
    if (res.status === 403 && gotForcedPasswordChange(body)) {
      return { ok: false, message: "Password change required." };
    }
    if (!res.ok) {
      return { ok: false, message: serverMessage(body) ?? "Could not generate a password." };
    }
    const tempPassword =
      typeof body?.tempPassword === "string" && body.tempPassword.trim()
        ? body.tempPassword.trim()
        : null;
    if (!tempPassword) {
      return { ok: false, message: "No temporary password came back from the server. Try again." };
    }
    return { ok: true, tempPassword };
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

export async function customerAction(
  id: string,
  action: "disable" | "enable",
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/customers/${encodeURIComponent(id)}/${action}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, action);
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/* Existing endpoint: PUT /api/admin/customers/:id/phone { phone }
   (audit-logged on the backend — the UI only sends the cleaned number). */
export async function updateCustomerPhone(
  id: string,
  phone: string,
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/customers/${encodeURIComponent(id)}/phone`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseAction(res, "update the number for");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/* ── Phase 3: customer reports & flag actions ──────────────────────────────
   Every error message here travels VERBATIM — the report's 409
   ("This customer already has an open flag."), the report's 400 reason
   message, and the flag 404 ("Flag not found.") show word for word. */
async function parseFlagWrite(
  res: Response,
  fallback: string,
): Promise<ActionResult> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (res.status === 401) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  if (res.status === 403 && gotForcedPasswordChange(body)) {
    return { ok: false, message: "Password change required." };
  }
  if (!res.ok) {
    return { ok: false, message: serverMessage(body) ?? fallback };
  }
  return {
    ok: true,
    ...(serverMessage(body) ? { message: serverMessage(body)! } : {}),
  };
}

/** POST /api/admin/users/customers/:id/report { reason }
 *  Allowed for admin | head_staff | staff (staff tokens must succeed here,
 *  unlike every other write in this module). */
export async function reportCustomer(
  customerId: string,
  reason: string,
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/customers/${encodeURIComponent(customerId)}/report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      },
      WRITE_TIMEOUT_MS,
    );
    return await parseFlagWrite(res, "Could not flag this customer.");
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}

/** POST /api/admin/users/flags/:id/approve | dismiss | watch (admin-only). */
export async function resolveFlag(
  id: string,
  action: "approve" | "dismiss" | "watch",
): Promise<ActionResult> {
  const token = getStaffOrAdminToken();
  if (!token) {
    return { ok: false, message: "Admin authorization required. Sign in again." };
  }
  const fallback =
    action === "approve"
      ? "Could not approve this flag."
      : action === "watch"
        ? "Could not update this flag."
        : "Could not dismiss this flag.";
  try {
    const res = await fetchWithTimeout(
      `${getApiUrl()}/api/admin/users/flags/${encodeURIComponent(id)}/${action}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      WRITE_TIMEOUT_MS,
    );
    return await parseFlagWrite(res, fallback);
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check the connection and try again.",
    };
  }
}
