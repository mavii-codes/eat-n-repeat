import app from "./app.js";
import { env } from "./config/env.js";
import { startHeartbeat } from "./services/sync/heartbeat.js";
import { startMenuPull } from "./services/menu-pull/index.js";

async function start() {
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`Eat n' Repeat API listening on http://0.0.0.0:${env.port}`);
  });

  startHeartbeat();
  // Online → Local menu pull runs only when MENU_SYNC_URL is configured
  // (local café backend); cloud instances ignore it internally.
  startMenuPull();
}

start().catch((error: unknown) => {
  console.error("Unable to start API:", error);
  process.exit(1);
});
