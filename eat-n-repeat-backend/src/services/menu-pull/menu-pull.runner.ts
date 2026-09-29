import { env } from "@/config/env";
import { menuPullService } from "./menu-pull.service";

const STARTUP_DELAY_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Automatic Online → Local menu pull. Starts only when MENU_SYNC_URL points
 * at a real online backend (never on cloud instances, never without config).
 *
 * - First run ~60s after boot so startup is never blocked.
 * - Then every MENU_SYNC_INTERVAL_MS (default 10 min).
 * - Concurrency-guarded, fully catch-all: failures log one line and leave
 *   the local system (menu, ordering, POS) completely untouched.
 */
export function startMenuPull(): void {
  const url = (env.menuSyncUrl || "").trim();
  if (!url || /example\.com/i.test(url)) {
    return;
  }

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const plan = await menuPullService.pull();
      if (plan.error) {
        console.warn(`[menu-pull] skipped: ${plan.error}`);
      } else {
        const applied = plan.applied ? "applied" : "no changes";
        console.log(
          `[menu-pull] ${applied}: +${plan.toCreateItems.length + plan.toCreateCategories.length} ` +
            `~${plan.toUpdateItems.length + plan.toUpdateCategories.length} ` +
            `arch${plan.toArchiveItems.length + plan.toArchiveCategories.length} ` +
            `conflicts=${plan.conflicts.length} blocked=${plan.blocked.length}`
        );
      }
    } catch (e: any) {
      console.warn(`[menu-pull] failed: ${e?.message ?? e}`);
    } finally {
      running = false;
    }
  };

  startTimer = setTimeout(() => {
    run();
    timer = setInterval(run, env.menuSyncIntervalMs);
    if (timer.unref) timer.unref();
  }, STARTUP_DELAY_MS);
  if (startTimer.unref) startTimer.unref();
}

export function stopMenuPull(): void {
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
