/**
 * Permanent mobile-number rules (Phase 3) — single validation site shared by
 * checkout (first-order capture) and the admin-only change endpoint.
 *
 * Convention: 11 digits starting with `09`. Input is normalized first
 * (spaces and dashes stripped) so `0917 123 4567` and `0917-123-4567`
 * are accepted and stored as `09171234567`.
 */

export function normalizePhoneNumber(raw: unknown): string {
  return String(raw ?? "").replace(/[\s-]/g, "").trim();
}

export function isValidPhoneNumber(raw: unknown): boolean {
  return /^09\d{9}$/.test(normalizePhoneNumber(raw));
}

export function phoneFormatMessage(): string {
  return "Mobile number must be 11 digits starting with 09.";
}
