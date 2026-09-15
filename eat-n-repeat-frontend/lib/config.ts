export function getApiUrl(): string {
  // If we are in the browser on localhost or a LAN IP, the backend is
  // ALWAYS on the same host (port 4000). This is checked FIRST so a stale
  // NEXT_PUBLIC_API_URL (e.g. yesterday's DHCP IP after switching Wi-Fi)
  // can never hijack API calls into hanging on a dead address.
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return `http://${hostname}:4000`;
    }
    // Public hostname (production): explicit env wins (backend may live
    // on a different host), else same-origin.
    // Make sure to set NEXT_PUBLIC_API_URL in your Vercel project settings!
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return window.location.origin;
  }

  // Fallback for Server-Side Rendering (SSR) where window is undefined and no env var is set
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
}
