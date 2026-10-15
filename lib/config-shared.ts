/**
 * Shared configuration utilities - pure functions only, no React hooks.
 * Safe to import in both client and server components.
 */

/**
 * Checks if the current hostname indicates a local backend.
 * Runs on both server and client.
 */
export function isLocalBackend(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Loopback hostnames only (this laptop itself). LAN IPs (192.168.x.x, …)
 * are DELIBERATELY excluded: the Electron café launcher always opens the
 * portal at the LAN-IP URL, so anything scoped here can never leak into
 * counter/offline operation.
 */
export function isLoopbackHostname(hostname?: string): boolean {
  const h = (
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "")
  )
    .trim()
    .toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Development-only override: render the Online-style Customer Portal on
 * localhost while STILL talking to the local backend
 * (getApiUrl() is untouched → http://localhost:4000 → XAMPP MySQL).
 *
 * Requires BOTH:
 *   1. NEXT_PUBLIC_LOCAL_ONLINE_UI=1 (dev .env.local only, never production)
 *   2. a loopback hostname (localhost / 127.0.0.1)
 *
 * LAN-IP access (Electron launcher, café devices) and production hostnames
 * always evaluate false here, so existing Local Mode is fully preserved.
 */
export function isDevOnlinePortal(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_LOCAL_ONLINE_UI !== "1") return false;
  return isLoopbackHostname();
}

/**
 * Normalizes a backend base URL: trims copy-paste whitespace, drops trailing
 * slashes, and drops a trailing "/api" (a very common env-var mistake that
 * otherwise sends calls to /api/api/... → 404 → misleading login errors).
 */
export function normalizeApiUrl(raw: string): string {
  let url = (raw || "").trim().replace(/\/+$/, "");
  if (/\/api$/i.test(url)) url = url.slice(0, -4);
  return url;
}

export function getApiUrl(): string {
  // If the environment variable is explicitly set, use it.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
  }

  // If we are in the browser, dynamically resolve the backend.
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Only append port 4000 for local development (localhost or any private/LAN IP)
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return `http://${hostname}:4000`;
    }
    // In production without NEXT_PUBLIC_API_URL, fallback to the same origin to avoid hanging on port 4000.
    // Make sure to set NEXT_PUBLIC_API_URL in your Vercel project settings!
    return window.location.origin;
  }

  // Fallback for Server-Side Rendering (SSR) where window is undefined and no env var is set
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
}