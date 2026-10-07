"use client";

import { useEffect, useState } from "react";
import { isLocalBackend, isDevOnlinePortal } from "./config-shared";

/**
 * Hydration-safe version of isLocalBackend() for use during render.
 * Returns false on the server AND on the client's first render (matching
 * the server HTML), then reconciles to the real value after mount.
 * Without this gate, localhost renders client=true vs server=false and
 * React throws a hydration mismatch (div vs a in the header).
 */
export function useIsLocalBackend(): boolean {
  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    setIsLocal(isLocalBackend());
  }, []);
  return isLocal;
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
export function useIsDevOnlinePortal(): boolean {
  const [isDev, setIsDev] = useState(false);
  useEffect(() => {
    setIsDev(isDevOnlinePortal());
  }, []);
  return isDev;
}

export type CustomerPortalMode = "local" | "online";

/**
 * Which Customer Portal variant to render. Online when the backend is not
 * local, OR when the dev override above applies (loopback + explicit flag).
 * Hydration-safe: starts as the SSR value ("online"), reconciles after
 * mount — same pattern as useIsLocalBackend().
 */
export function useCustomerPortalMode(): CustomerPortalMode {
  const [mode, setMode] = useState<"local" | "online">("online");
  useEffect(() => {
    setMode(isLocalBackend() && !isDevOnlinePortal() ? "local" : "online");
  }, []);
  return mode;
}