export function getApiUrl(): string {
  // If the environment variable is explicitly set, use it.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
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
