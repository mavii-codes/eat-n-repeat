/**
 * Unified authentication token storage and retrieval for Staff and Admin portals.
 *
 * Keys used:
 * - `eat-n-repeat-auth-session`: Stored session containing user info and bearer JWT
 * - `eat-n-repeat-staff-token`: Direct staff bearer JWT
 * - `eat-n-repeat-admin-token`: Direct admin bearer JWT
 */

export const SESSION_KEY = "eat-n-repeat-auth-session";
export const STAFF_TOKEN_KEY = "eat-n-repeat-staff-token";
export const ADMIN_TOKEN_KEY = "eat-n-repeat-admin-token";

/**
 * Checks if a JWT string is well-formed and not expired.
 * Does not verify signature (which requires backend secret), but validates structure and expiration timestamp.
 */
export function isTokenValid(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      if (typeof payload.exp === "number") {
        if (payload.exp * 1000 <= Date.now()) {
          return false;
        }
      }
      return true;
    }
    return token.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Returns the `role` claim of the given (or the currently stored) JWT.
 * Returns null for tokens without a role claim (e.g. customer JWTs).
 * Client-side convenience only — the server remains the authority.
 */
export function getTokenRole(token: string = getStaffOrAdminToken() ?? ""): string | null {
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      )
    );
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Returns a valid staff or admin token from localStorage.
 * Checks:
 * 1. `eat-n-repeat-auth-session` (parsed.token)
 * 2. `eat-n-repeat-admin-token`
 * 3. `eat-n-repeat-staff-token`
 *
 * Automatically purges expired tokens to prevent repeated 401s.
 * Never returns an expired token.
 */
export function getStaffOrAdminToken(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Check active session first
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) {
        if (isTokenValid(parsed.token)) {
          return parsed.token;
        } else {
          // Token is expired - remove stale token from session object
          delete parsed.token;
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        }
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  // 2. Check individual token keys
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (adminToken) {
    if (isTokenValid(adminToken)) {
      return adminToken;
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  }

  const staffToken = localStorage.getItem(STAFF_TOKEN_KEY);
  if (staffToken) {
    if (isTokenValid(staffToken)) {
      return staffToken;
    } else {
      localStorage.removeItem(STAFF_TOKEN_KEY);
    }
  }

  return null;
}

/**
 * Ensures all token keys are in sync across storage keys.
 */
export function syncAuthTokens(token: string, role?: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
    if (role === "admin") {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        parsed.token = token;
        localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // LocalStorage quota or access error
  }
}

/**
 * Clears all staff and admin auth tokens and session from localStorage.
 */
export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

/**
 * True when the stored session was flagged by the backend as
 * mustChangePassword (forced first-sign-in password change). Read from
 * storage — not context state — so guards work after every reload.
 */
export function sessionMustChangePassword(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.mustChangePassword === true;
  } catch {
    return false;
  }
}

/**
 * True when an API body is the backend's forced-password-change rejection
 * (403 { code: "MUST_CHANGE_PASSWORD" }). Guard locations route the session
 * to /change-password when this fires.
 */
export function isMustChangePasswordBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { code?: unknown }).code === "MUST_CHANGE_PASSWORD"
  );
}
