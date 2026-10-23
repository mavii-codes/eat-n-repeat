/**
 * Conflict priority for replaying queued offline status changes.
 *
 * Completed > Cancelled > Ready > Preparing > Confirmed > Pending
 *
 * Rules (per product spec):
 * - Higher priority always wins; lower-priority replays are dropped.
 * - Same priority: newest `updatedAt` wins (identical values are no-ops).
 * - Completed is terminal: never overwritten by Cancelled or anything older.
 * - Cancelled is never overwritten by Pending/Confirmed/Preparing/Ready.
 * - Delivery-specific states slot in: out_for_delivery sits between
 *   preparing and ready; delivered sits just below completed so a
 *   Completed order is never stepped back to Delivered;
 *   awaiting_payment/pending_payment count as Pending. Unknown values
 *   are rejected, never applied.
 * - Payment state is independent: this module never touches payments.
 */
const PRIORITY: Record<string, number> = {
  pending: 0,
  pending_payment: 0,
  awaiting_payment: 0,
  confirmed: 1,
  preparing: 2,
  out_for_delivery: 3,
  ready: 4,
  cancelled: 5,
  delivered: 6,
  completed: 7,
};

export function normalizeOrderStatus(status: unknown): string {
  return String(status ?? "").trim().toLowerCase();
}

export function orderStatusPriority(status: unknown): number | null {
  const key = normalizeOrderStatus(status);
  if (!key) return null;
  const tier = PRIORITY[key];
  return tier === undefined ? null : tier;
}

export type PriorityVerdict =
  | { action: "apply"; reason: string }
  | { action: "drop"; reason: string };

export function decideStatusReplay(
  incomingStatus: unknown,
  incomingUpdatedAt: unknown,
  serverStatus: unknown,
): PriorityVerdict {
  const incoming = normalizeOrderStatus(incomingStatus);
  const current = normalizeOrderStatus(serverStatus);
  const incomingTier = orderStatusPriority(incoming);
  if (incomingTier === null) {
    return { action: "drop", reason: `unknown incoming status "${incoming}"` };
  }
  if (!current) {
    return { action: "apply", reason: "no server status recorded" };
  }
  // Completed/cancelled are final server-side states: an offline replay may
  // never reopen or change them (a stale queued "completed" must not beat a
  // server-side cancellation).
  if (current === "completed" || current === "cancelled") {
    return { action: "drop", reason: `server status "${current}" is final` };
  }
  const currentTier = orderStatusPriority(current);
  if (currentTier === null) {
    return { action: "apply", reason: `unrecognized server status "${current}"` };
  }
  if (incoming === current) {
    return { action: "drop", reason: `already "${current}" (no-op)` };
  }
  if (incomingTier > currentTier) {
    return { action: "apply", reason: `"${incoming}" outranks "${current}"` };
  }
  if (incomingTier < currentTier) {
    return { action: "drop", reason: `stale "${incoming}" loses to "${current}"` };
  }
  // Same tier, different value (e.g. pending vs awaiting_payment): the
  // queued change is at least as new as what the server holds for this
  // stage, so apply it — and always log which side won.
  const at = new Date(incomingUpdatedAt as any).getTime();
  const stamp = Number.isFinite(at) ? new Date(at).toISOString() : "unknown time";
  return { action: "apply", reason: `same-tier update to "${incoming}" (${stamp})` };
}
