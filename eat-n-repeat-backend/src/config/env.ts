import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  const value = process.env[name] ?? fallback;
  return value ? value : undefined;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Raw comma-separated CLIENT_ORIGIN value. */
const rawOrigins = required("CLIENT_ORIGIN", "http://localhost:3000");

const isProduction = (process.env.NODE_ENV ?? "development") === "production";

// Production must fail closed at boot when auth/webhook secrets are missing.
// Local development keeps the historical fallbacks so existing workflows work.
const jwtSecret = required(
  "JWT_SECRET",
  isProduction ? undefined : "development-only-secret-change-me",
);
const xenditWebhookToken = isProduction
  ? required("XENDIT_WEBHOOK_TOKEN")
  : process.env.XENDIT_WEBHOOK_TOKEN ?? "";

// Number of trusted proxy hops in front of Express. 0 disables proxy trust.
const trustProxy = Math.max(
  0,
  Math.trunc(optionalNumber("TRUST_PROXY", 1)),
);

const rateLimits = {
  signupHourly: optionalNumber("RATE_LIMIT_SIGNUP_HOURLY", 5),
  signupDaily: optionalNumber("RATE_LIMIT_SIGNUP_DAILY", 20),
  checkoutHourly: optionalNumber("RATE_LIMIT_CHECKOUT_HOURLY", 30),
  loginMaxFailures: optionalNumber("RATE_LIMIT_LOGIN_MAX_FAILURES", 5),
  loginLockMinutes: optionalNumber("RATE_LIMIT_LOGIN_LOCK_MINUTES", 10),
  forgotHourly: optionalNumber("RATE_LIMIT_FORGOT_HOURLY", 5),
  resetHourly: optionalNumber("RATE_LIMIT_RESET_HOURLY", 10),
  // Promo-code validate guard: 10 attempts per 15 min (env-tunable),
  // enforced per-account+IP and per-IP.
  promoValidateAttempts: optionalNumber("RATE_LIMIT_PROMO_MAX_ATTEMPTS", 10),
  promoWindowMinutes: optionalNumber("RATE_LIMIT_PROMO_WINDOW_MINUTES", 15),
} as const;

const newAccountMaxOpenOrders = optionalNumber("NEW_ACCOUNT_MAX_OPEN_ORDERS", 2);
const newAccountCooldownMinutes = optionalNumber("NEW_ACCOUNT_COOLDOWN_MINUTES", 10);
const guestCheckoutCooldownMinutes = optionalNumber("GUEST_CHECKOUT_COOLDOWN_MINUTES", 10);
const reviewStreamRatePerMin = optionalNumber("REVIEW_STREAM_RATE_PER_MIN", 30);

const flags = {
  signupPerIp: optionalNumber("FLAG_SIGNUP_PER_IP", 3),
  cancelledStreak: optionalNumber("FLAG_CANCELLED_STREAK", 3),
  failedLogins: optionalNumber("FLAG_FAILED_LOGINS", 5),
} as const;

const turnstileSecretKey = optional("TURNSTILE_SECRET_KEY") ?? null;
const turnstileSiteKey = optional("TURNSTILE_SITE_KEY") ?? null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Primary (first) origin — kept for backward compat. */
  clientOrigin: rawOrigins.split(",")[0].trim(),
  /** All configured origins, split on comma. */
  clientOrigins: rawOrigins.split(",").map((o) => o.trim()),
  // Base URL customers are sent back to after paying on Xendit.
  // Explicit CUSTOMER_RETURN_URL wins (production must be the real
  // customer domain, e.g. https://www.eatnrepeat.online); otherwise
  // falls back to the first CLIENT_ORIGIN entry (local dev).
  customerReturnBase: (process.env.CUSTOMER_RETURN_URL
    || rawOrigins.split(",")[0].trim()
  ).replace(/\/+$/, ""),
  jwtSecret,
  databaseUrl: required("DATABASE_URL", "mysql://root:@127.0.0.1:3306/eat_n_repeat"),
  xendit: {
    secretKey: required("XENDIT_SECRET_KEY", "dummy_xendit_secret_key"),
    webhookToken: xenditWebhookToken,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || '"Eat n RepEat Cafe" <onboarding@resend.dev>',
  },
  gmailApi: {
    clientId: process.env.GMAIL_CLIENT_ID || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
    user: process.env.SMTP_USER || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || (
      process.env.SMTP_USER
        ? `"Eat n RepEat Cafe" <${process.env.SMTP_USER}>`
        : '"Eat n RepEat Cafe" <onboarding@resend.dev>'
    ),
  },
  cloudSyncUrl: process.env.CLOUD_SYNC_URL || "https://eat-n-repeat-cloud.example.com/api/sync/push",
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS ?? 30000),
  // Optional shared secret for the headless café heartbeat sender (which
  // holds no JWT). When set, /api/sync/heartbeat requires a matching
  // `x-sync-secret` header. When unset, heartbeat stays open (timestamp-only
  // write) with a boot warning.
  syncSharedSecret: process.env.SYNC_SHARED_SECRET ?? "",
  // Online → Local menu pull (local backend only). Base URL of the ONLINE
  // backend, e.g. https://<render-service>.onrender.com. Empty = disabled.
  menuSyncUrl: process.env.MENU_SYNC_URL || "",
  menuSyncIntervalMs: Number(process.env.MENU_SYNC_INTERVAL_MS ?? 600000),
  // When true, every pull (auto + manual) is a dry-run: full preview report,
  // zero writes (no database changes, no backup file, no sync-state update).
  menuSyncDryRun: (process.env.SYNC_MENU_DRY_RUN ?? "").toLowerCase() === "true",

  /** Trusted proxy hop count; 0 means `trust proxy` is disabled. */
  trustProxy,

  // Security limits consumed by the middleware/security modules.
  rateLimits,
  newAccountMaxOpenOrders,
  newAccountCooldownMinutes,
  guestCheckoutCooldownMinutes,
  reviewStreamRatePerMin,
  flags,
  turnstile: {
    secretKey: turnstileSecretKey,
    siteKey: turnstileSiteKey,
  },

  // Exact env-var aliases for lane interoperability; canonical access above.
  TRUST_PROXY: trustProxy,
  RATE_LIMIT_SIGNUP_HOURLY: rateLimits.signupHourly,
  RATE_LIMIT_SIGNUP_DAILY: rateLimits.signupDaily,
  RATE_LIMIT_CHECKOUT_HOURLY: rateLimits.checkoutHourly,
  RATE_LIMIT_LOGIN_MAX_FAILURES: rateLimits.loginMaxFailures,
  RATE_LIMIT_LOGIN_LOCK_MINUTES: rateLimits.loginLockMinutes,
  RATE_LIMIT_FORGOT_HOURLY: rateLimits.forgotHourly,
  RATE_LIMIT_RESET_HOURLY: rateLimits.resetHourly,
  RATE_LIMIT_PROMO_MAX_ATTEMPTS: rateLimits.promoValidateAttempts,
  RATE_LIMIT_PROMO_WINDOW_MINUTES: rateLimits.promoWindowMinutes,
  NEW_ACCOUNT_MAX_OPEN_ORDERS: newAccountMaxOpenOrders,
  NEW_ACCOUNT_COOLDOWN_MINUTES: newAccountCooldownMinutes,
  GUEST_CHECKOUT_COOLDOWN_MINUTES: guestCheckoutCooldownMinutes,
  REVIEW_STREAM_RATE_PER_MIN: reviewStreamRatePerMin,
  FLAG_SIGNUP_PER_IP: flags.signupPerIp,
  FLAG_CANCELLED_STREAK: flags.cancelledStreak,
  FLAG_FAILED_LOGINS: flags.failedLogins,
  TURNSTILE_SECRET_KEY: turnstileSecretKey,
  TURNSTILE_SITE_KEY: turnstileSiteKey,
} as const;
