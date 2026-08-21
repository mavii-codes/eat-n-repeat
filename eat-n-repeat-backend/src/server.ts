import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { initializeDatabase } from "./database.js";
import authRouter from "./routes/auth.js";
import stockRouter from "./routes/stock.js";
import paymentsRouter from "./routes/payments.js";
import webhooksRouter from "./routes/webhooks.js";
import eventsRouter from "./routes/events.js";
import customerAuthRouter from "./routes/customerAuth.js";
import customerSettingsRouter from "./routes/customerSettings.js";
import customerNotificationsRouter from "./routes/customerNotifications.js";
import customerAddressesRouter from "./routes/customerAddresses.js";
import deliveryRouter from "./routes/delivery.js";
import staffNotificationsRouter from "./routes/staffNotifications.js";
import addonsRouter from "./routes/addons.js";
import customerFavoritesRouter from "./routes/customerFavorites.js";

import { syncRouter } from "./routes/sync.js";
import { startSyncWorker } from "./services/syncWorker.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/stock", stockRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/events", eventsRouter);
app.use("/api/customer-auth", customerAuthRouter);
app.use("/api/customer-settings", customerSettingsRouter);
app.use("/api/customer-notifications", customerNotificationsRouter);
app.use("/api/customer-addresses", customerAddressesRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/staff-notifications", staffNotificationsRouter);
app.use("/api/addons", addonsRouter);
app.use("/api/customer-favorites", customerFavoritesRouter);
app.use("/api/sync", syncRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

async function start() {
  await initializeDatabase();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Eat n' Repeat API listening on all interfaces at http://0.0.0.0:${config.port}`);
  });
  
  // Start the background synchronization worker for Offline Café Mode
  startSyncWorker();
}

start().catch((error: unknown) => {
  console.error("Unable to start API:", error);
  process.exit(1);
});
