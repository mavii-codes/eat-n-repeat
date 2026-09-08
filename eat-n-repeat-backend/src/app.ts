import cors from "cors";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import helmet from "helmet";
import { env } from "@/config/env";
import { errorHandler } from "@/middleware/error.middleware";
import { routes } from "@/routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Mount all routes under /api
app.use("/api", routes);

// 404 handler
app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

// Global error handler
app.use(errorHandler);

export default app;
