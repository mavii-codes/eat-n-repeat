import "dotenv/config";

const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: required("CLIENT_ORIGIN", "http://localhost:3000"),
  jwtSecret: required("JWT_SECRET", "development-only-secret-change-me"),
  database: (() => {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (url) {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: Number(parsed.port || 3306),
        user: parsed.username,
        password: parsed.password,
        name: parsed.pathname.replace("/", ""),
      };
    }
    return {
      host: required("DB_HOST", "localhost"),
      port: Number(process.env.DB_PORT ?? 3306),
      user: required("DB_USER", "root"),
      password: process.env.DB_PASSWORD ?? "",
      name: required("DB_NAME", "eat_n_repeat"),
    };
  })(),
  xendit: {
    secretKey: required("XENDIT_SECRET_KEY", "dummy_xendit_secret_key"),
    webhookToken: process.env.XENDIT_WEBHOOK_TOKEN ?? "",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || '"Eat n RepEat Cafe" <onboarding@resend.dev>',
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Eat n RepEat Cafe" <${process.env.SMTP_USER}>` : '"Eat n RepEat Cafe" <onboarding@resend.dev>'),
  }
};
