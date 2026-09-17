"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "eat-n-repeat-mode";
const TOGGLE_EVENT = "local-mode-toggled";

type Mode = "online" | "local";

// In-memory fallback for the mode. Every localStorage touch below is
// wrapped in try/catch: if storage throws, resolution continues from this
// value instead of aborting the hook's effect (which used to freeze the
// badge on Online with toggles dead and no visible error).
let memoryMode: Mode = "online";

function getModeFromStorage(): Mode {
  if (typeof window === "undefined") return "online";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "local" || stored === "online") {
      memoryMode = stored;
      return stored;
    }
  } catch {
    // Storage can throw (blocked permissions, quota, hardened profiles).
    // Fall through to the in-memory value instead of aborting the caller.
  }
  return memoryMode;
}

function getModeFromURL(): Mode | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "local" || mode === "online") return mode;
  return null;
}

function setModeToStorage(mode: Mode) {
  memoryMode = mode;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Memory fallback already updated above; storage failure is non-fatal.
  }
}

/**
 * Reconcile mode from URL (authoritative) or localStorage (fallback).
 * If URL has ?mode=local, it wins and is persisted to localStorage.
 * Returns the resolved isLocalMode boolean.
 */
function reconcileMode(): boolean {
  const urlMode = getModeFromURL();
  if (urlMode) {
    setModeToStorage(urlMode);
    return urlMode === "local";
  }
  return getModeFromStorage() === "local";
}

/**
 * Keep `?mode=local` in the address bar while local mode is active, so
 * client-side navigation (Menu, Details, Cart…) can never silently drop it.
 * One-directional (add-only) and idempotent: when already consistent it is a
 * no-op, so our own history patch (which re-runs reconcile) cannot loop.
 */
function syncModeParamToUrl(): void {
  if (typeof window === "undefined") return;
  try {
    if (getModeFromStorage() !== "local") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("mode") === "local") return;
    url.searchParams.set("mode", "local");
    window.history.replaceState(null, "", url.toString());
  } catch {
    // Non-fatal cosmetic sync; never break the caller.
  }
}

export function useLocalMode() {
  // NOTE: intentionally NOT initialized from the URL synchronously — SSR has
  // no window, so a client-side initializer would render a different tree
  // than the server and crash hydration (amber vs emerald badge). First
  // render is always `false` on both sides; the effect below reconciles.
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);

  useEffect(() => {
    // Initial reconciliation from URL or localStorage
    setIsLocalMode(reconcileMode());
    syncModeParamToUrl();

    // ── Browser back/forward ────────────────────────────────────────────
    const handlePopState = () => {
      setIsLocalMode(reconcileMode());
      syncModeParamToUrl();
    };

    // ── Next.js client-side navigation ──────────────────────────────────
    // Next.js uses history.pushState / replaceState under the hood.
    // We monkey-patch them to re-check the URL after each navigation.
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = function (
      ...args: Parameters<typeof history.pushState>
    ) {
      origPushState(...args);
      // Read URL in the next microtask so the browser has updated location
      queueMicrotask(() => {
        setIsLocalMode(reconcileMode());
        syncModeParamToUrl();
      });
    };

    history.replaceState = function (
      ...args: Parameters<typeof history.replaceState>
    ) {
      origReplaceState(...args);
      queueMicrotask(() => {
        setIsLocalMode(reconcileMode());
        syncModeParamToUrl();
      });
    };

    // ── Custom toggle event (from startLocalMode / stopLocalMode) ──────
    const handleToggle = () => {
      setIsLocalMode(getModeFromStorage() === "local");
    };

    // ── Cross-tab sync via storage event ───────────────────────────────
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIsLocalMode(getModeFromStorage() === "local");
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener(TOGGLE_EVENT, handleToggle);
    window.addEventListener("storage", handleStorage);

    return () => {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(TOGGLE_EVENT, handleToggle);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return isLocalMode;
}

export function setLocalMode(mode: Mode) {
  setModeToStorage(mode);
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

export function startLocalMode() {
  setLocalMode("local");
}

export function stopLocalMode() {
  setLocalMode("online");
}

export function getCurrentMode(): Mode {
  return getModeFromStorage();
}
