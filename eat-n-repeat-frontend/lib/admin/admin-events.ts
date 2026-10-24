import { getStaffOrAdminToken, getTokenRole } from "@/lib/admin/auth-token";

const RECONNECT_DELAY_MS = 5000;

/**
 * Shared admin invalidation stream (SSE).
 *
 * EventSource cannot set request headers, so the bearer token travels as a
 * query parameter (same pattern as order-chat). Payloads are intentionally
 * tiny ({ type, at }) — callers refetch their own scoped data. Missed events
 * are not replayed, so a (re)connect emits "SUBSCRIBED" to trigger one
 * refetch.
 *
 * Never throws. Returns a cleanup that clears the reconnect timer, detaches
 * the listeners, and closes the connection.
 */
export function subscribeAdminEvents(onEvent: (type: string) => void): () => void {
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const connect = () => {
    if (cancelled || es) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const token = getStaffOrAdminToken();
    if (!token) return;

    // The server rejects non-admin roles with 403. Subscribing anyway would
    // fire reconnect attempts every 5s (and 403 console noise) on staff
    // sessions, so gate client-side; the server remains the authority.
    if (getTokenRole(token) !== "admin") return;

    let next: EventSource;
    try {
      next = new EventSource(
        `/api/events/admin/stream?token=${encodeURIComponent(token)}`
      );
    } catch {
      return;
    }
    es = next;

    next.onopen = () => {
      if (cancelled) return;
      try {
        onEvent("SUBSCRIBED");
      } catch {
        // Consumer errors must not break the stream.
      }
    };

    next.onmessage = (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);
        if (data && typeof data.type === "string") {
          onEvent(data.type);
        }
      } catch {
        // Malformed/keep-alive frame — ignore.
      }
    };

    next.onerror = () => {
      if (cancelled || es !== next) return;
      console.warn("[admin-events] stream closed; reconnecting in 5s.");
      try {
        next.close();
      } catch {
        // Ignore close errors during reconnect.
      }
      if (es === next) es = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, RECONNECT_DELAY_MS);
      }
    };
  };

  connect();

  return () => {
    cancelled = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (es) {
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      try {
        es.close();
      } catch {
        // Ignore close errors on unmount.
      }
      es = null;
    }
  };
}
