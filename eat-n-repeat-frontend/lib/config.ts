export function getApiUrl(): string {
  // If the environment variable is explicitly set, use it.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // If we are in the browser, dynamically resolve the backend to the same host on port 4000.
  // This enables LAN access without hardcoding an IP address.
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `http://${hostname}:4000`;
  }

  // Fallback for Server-Side Rendering (SSR) where window is undefined and no env var is set
  return "http://127.0.0.1:4000";
}
