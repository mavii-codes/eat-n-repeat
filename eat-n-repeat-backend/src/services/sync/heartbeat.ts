import { env } from "@/config/env";

const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60000);

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat sender that POSTs to the cloud sync endpoint
 * every HEARTBEAT_INTERVAL_MS milliseconds.
 *
 * Only runs when CLOUD_SYNC_URL is set to a non-example URL.
 * All errors are silently swallowed — at most one concise log line per failure.
 */
export function startHeartbeat(): void {
  const url = env.cloudSyncUrl;

  // Guard: only run when CLOUD_SYNC_URL points to a real cloud endpoint
  if (!url || url.includes("example.com")) {
    return;
  }

  // Compute heartbeat endpoint from cloud sync URL
  const heartbeatUrl = url.replace(/\/sync\/push\/?$/, "/sync/heartbeat");

  timer = setInterval(async () => {
    try {
      await fetch(heartbeatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeCode: "main", at: new Date().toISOString() }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Silent — one concise log line per failure
      console.warn("[heartbeat] failed to reach cloud");
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Allow the process to exit without waiting for the timer
  if (timer.unref) {
    timer.unref();
  }
}

export function stopHeartbeat(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
