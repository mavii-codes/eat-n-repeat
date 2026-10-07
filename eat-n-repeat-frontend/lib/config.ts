// Re-export shared config (safe for both client and server)
export {
  isLocalBackend,
  isLoopbackHostname,
  isDevOnlinePortal,
  normalizeApiUrl,
  getApiUrl,
} from "./config-shared";

// Re-export client-only hooks (only use in client components)
export {
  useIsLocalBackend,
  useIsDevOnlinePortal,
  useCustomerPortalMode,
  type CustomerPortalMode,
} from "./config-client";