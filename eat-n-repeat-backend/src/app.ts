import cors from "cors";
// NOTE: do NOT set dns.setDefaultResultOrder globally. Forcing ipv4first
// broke Xendit (api.xendit.co IPv4 egress resets on some networks), while
// SMTP is pinned to IPv4 via `family: 4` on its transport (src/lib/email.ts).

import express from "express";
import helmet from "helmet";
import { env } from "@/config/env";
import { errorHandler } from "@/middleware/error.middleware";
import { routes } from "@/routes";

const app = express();

// Must be configured before any middleware so req.ip reflects the real client
// when the API sits behind a known number of proxy hops. TRUST_PROXY=0
// disables proxy trust (Express default).
const trustProxyHops = Number(env.trustProxy);
app.set("trust proxy", trustProxyHops > 0 ? trustProxyHops : false);

app.use(helmet());
// Allow configured CLIENT_ORIGIN entries (comma-separated) plus dynamic
// LAN origins so café phones on the Wi-Fi (e.g. http://192.168.x.x:3000)
// can reach the API.  LAN origins are restricted to common dev ports
// (3000, 3001).  Online behaviour is unchanged: non-local origins are
// rejected unless explicitly listed in CLIENT_ORIGIN.
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (curl, health checks, same-origin) — allow.
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        const host = url.hostname;
        const port = Number(url.port) || (url.protocol === "https:" ? 443 : 80);

        // 1) Exact match against every comma-separated CLIENT_ORIGIN entry.
        if (env.clientOrigins.includes(origin)) {
          return callback(null, true);
        }

        // 2) Dynamic LAN / localhost validation — restricted to common dev ports.
        const isLocalhost = host === "localhost" || host === "127.0.0.1";
        const isLan =
          host.startsWith("192.168.") ||
          host.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host);

        if ((isLocalhost || isLan) && (port === 3000 || port === 3001)) {
          return callback(null, true);
        }
      } catch {
        // Fall through to rejection on malformed origin.
      }
      return callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Mount all routes under /api
app.use("/api", routes);

// 404 handler
app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

// Global error handler
app.use(errorHandler);

export default app;
