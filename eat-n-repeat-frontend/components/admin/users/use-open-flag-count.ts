"use client";

/* Open-flag count for the User Management sidebar badge (admin-only).

   The lightest event-refresh pattern (same idea as salesEventsVersion in
   AdminDataContext, but standalone): one 60s interval + refresh on tab
   focus/visibility + refresh on the shared "eat-n-repeat:flags-changed"
   window event dispatched after a successful report or flag decision.
   Staff sessions never poll — the badge is admin-only and the endpoint
   itself is admin-only. */

import { useEffect, useState } from "react";
import { getStaffOrAdminToken, getTokenRole } from "@/lib/admin/auth-token";
import { fetchOpenFlagCount } from "./api";

export const FLAGS_CHANGED_EVENT = "eat-n-repeat:flags-changed";

const POLL_INTERVAL_MS = 60000;

/** Tell every listener (the badge, open tabs) that flag data changed. */
export function notifyFlagsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FLAGS_CHANGED_EVENT));
  }
}

export function useOpenFlagCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchCount = async () => {
      if (inFlight) return;
      const token = getStaffOrAdminToken();
      // Gate client-side by role like subscribeAdminEvents does: the badge
      // never polls for staff/head_staff sessions. Server stays the authority.
      if (!token || getTokenRole(token) !== "admin") return;
      inFlight = true;
      try {
        const result = await fetchOpenFlagCount();
        if (!cancelled && result.ok) {
          setCount(result.count);
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    // visibilitychange fires when returning to the tab; focus covers
    // window re-activation. Both are the "cheap freshness" paths.
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener(FLAGS_CHANGED_EVENT, fetchCount);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener(FLAGS_CHANGED_EVENT, fetchCount);
    };
  }, []);

  return count;
}
