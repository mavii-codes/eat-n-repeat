import app from "./app.js";
import { env } from "./config/env.js";
import { startHeartbeat } from "./services/sync/heartbeat.js";

async function start() {
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`Eat n' Repeat API listening on http://0.0.0.0:${env.port}`);
  });

  startHeartbeat();
}

start().catch((error: unknown) => {
  console.error("Unable to start API:", error);
  process.exit(1);
});
