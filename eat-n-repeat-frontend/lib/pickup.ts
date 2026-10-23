import { formatPhTime } from "@/lib/admin/delivery-utils";

/**
 * Pick-Up / Take-Out rules shared by the cart UI and every place pickup
 * orders are displayed. Keep in sync with the backend
 * (payments.service.ts: PICKUP_PREP_BUFFER_MINUTES / name rules).
 */

/** Minimum notice before the promised collection time (single configurable
 *  constant; default 20 minutes — must match the backend default). */
export const PICKUP_PREP_BUFFER_MINUTES = 20;

/** Slots step in minutes (15-minute grid). */
export const PICKUP_SLOT_STEP_MINUTES = 15;

/** Manila is UTC+8 year-round (no DST), so a fixed offset is exact. Slots
 *  are generated on Manila wall-clock time regardless of browser timezone. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Letters (Latin incl. accents like ñ/é), spaces, and . - ' only.
const PICKUP_NAME_REGEX = /^[A-Za-z\u00C0-\u024F .'-]+$/;

/** Trim + collapse inner whitespace ("Juan   Dela  Cruz" → "Juan Dela Cruz"). */
export function normalizePickupName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** 2-60 chars after normalization, allowed characters only. */
export function isValidPickupName(value: string): boolean {
  const normalized = normalizePickupName(value);
  if (normalized.length < 2 || normalized.length > 60) return false;
  return PICKUP_NAME_REGEX.test(normalized);
}

/** Inline error message for the pick-up name field (null when valid). */
export function pickupNameError(value: string): string | null {
  if (!value.trim()) return "Pick-up name is required.";
  if (!isValidPickupName(value)) {
    return "Use 2-60 characters: letters, spaces, and . - ' only.";
  }
  return null;
}

export type PickupSlot = { value: string; label: string };

/**
 * Today's selectable pick-up slots on a 15-minute grid (Asia/Manila):
 * earliest = now + prep buffer rounded up to the next step, latest = 23:45
 * (the café has no stored closing time, so no cap beyond end of day).
 * Past times are never included. Returns [] when none remain today.
 */
export function generatePickupSlots(nowMs: number = Date.now()): PickupSlot[] {
  // Shift the epoch by the Manila offset so UTC getters read Manila wall time.
  const shifted = new Date(nowMs + MANILA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const nowMinutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const earliest = nowMinutes + PICKUP_PREP_BUFFER_MINUTES;
  const firstSlot = Math.ceil(earliest / PICKUP_SLOT_STEP_MINUTES) * PICKUP_SLOT_STEP_MINUTES;
  const lastSlot = 23 * 60 + 45; // 11:45 PM

  const slots: PickupSlot[] = [];
  for (let t = firstSlot; t <= lastSlot; t += PICKUP_SLOT_STEP_MINUTES) {
    const wallUtc = Date.UTC(year, month, day, Math.floor(t / 60), t % 60);
    const real = new Date(wallUtc - MANILA_OFFSET_MS);
    slots.push({ value: real.toISOString(), label: formatPhTime(real) });
  }
  return slots;
}

/**
 * One-line display used wherever pickup orders appear:
 * "Pick up by: Juan Dela Cruz · 3:30 PM".
 * Falls back to the customer's account name for legacy rows without
 * pickupName; returns null when there is nothing meaningful to show
 * (the existing "Pick-Up / Take-Out" label still renders from order type).
 */
export function formatPickupLine(
  pickupName?: string | null,
  pickupAt?: string | null,
  fallbackName?: string | null,
): string | null {
  const who =
    (typeof pickupName === "string" && pickupName.trim()) ||
    (typeof fallbackName === "string" && fallbackName.trim()) ||
    null;
  const when = pickupAt ? formatPhTime(pickupAt) : "";
  if (who && when) return `Pick up by: ${who} · ${when}`;
  if (who) return `Pick up by: ${who}`;
  if (when) return `Pick-up time: ${when}`;
  return null;
}
