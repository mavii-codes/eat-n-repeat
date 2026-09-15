import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

/** Raw comma-separated CLIENT_ORIGIN value. */
const rawOrigins = required("CLIENT_ORIGIN", "http://localhost:3000");

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Primary (first) origin — kept for backward compat. */
  clientOrigin: rawOrigins.split(",")[0].trim(),
  /** All configured origins, split on comma. */
  clientOrigins: rawOrigins.split(",").map((o) => o.trim()),
  jwtSecret: required("JWT_SECRET", "development-only-secret-change-me"),
  databaseUrl: required("DATABASE_URL", "mysql://root:@127.0.0.1:3306/eat_n_repeat"),
  xendit: {
    secretKey: required("XENDIT_SECRET_KEY", "dummy_xendit_secret_key"),
    webhookToken: process.env.XENDIT_WEBHOOK_TOKEN ?? "",
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
} as const;
