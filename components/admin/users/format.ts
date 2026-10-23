/* Display helpers for the User Management page: relative last-login labels,
   short created dates, humanized activity labels, and meta summaries.
   Calm, grounded English — no jargon, no emojis. */

import type { ActivityMeta } from "./types";

/** Relative label for lastLoginAt: "2d ago" / "Just now" / "Never". */
export function relativeLastLogin(
  iso: string | null | undefined,
): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Never";
  const diffMs = Date.now() - then;
  // Future timestamps (clock skew between devices) read as "Just now".
  if (diffMs <= 0) return "Just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/** Short created date for table cells: "Oct 20, 2026". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* Humanized activity labels. Verbatim backend values are mapped here; any
   future/trial action still renders readably by de-snake-casing. */
const ACTION_LABELS: Record<string, string> = {
  staff_disabled: "Staff account disabled",
  staff_enabled: "Staff account enabled",
  staff_password_reset: "Staff password reset",
  customer_disabled: "Customer account disabled",
  customer_enabled: "Customer account enabled",
  customer_phone_edited: "Customer phone edited",
  initial_password_change: "Initial password changed",
  /* Phase 3: customer report / flag lifecycle. */
  customer_reported: "Customer reported by staff",
  system_customer_flagged: "System flagged customer",
  flag_approved: "Flag approved",
  flag_watching: "Flag set to keep watching",
  flag_dismissed: "Flag dismissed",
  flag_auto_dismissed: "Flag auto-dismissed",
};

export function humanizeAction(action: string | null | undefined): string {
  const raw = (action ?? "").trim();
  if (!raw) return "—";
  const known = ACTION_LABELS[raw.toLowerCase()];
  if (known) return known;
  return raw
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Small green/amber/red tone for the humanized label in the Activity table. */
export function actionTone(action: string | null | undefined): string {
  const raw = (action ?? "").toLowerCase();
  if (raw.endsWith("_disabled")) return "text-red-700";
  if (raw.endsWith("_enabled")) return "text-green-700";
  if (raw.endsWith("_password_reset") || raw === "initial_password_change")
    return "text-amber-700";
  /* Phase 3 flag actions: reports and system flags raise attention, an
     approved flag is a retained (positive-intent) mark, watching is blue. */
  if (
    raw === "customer_reported" ||
    raw === "system_customer_flagged" ||
    raw === "flag_watching"
  )
    return "text-amber-700";
  if (raw === "flag_approved") return "text-green-700";
  /* flag_dismissed / flag_auto_dismissed fall through to the calm default. */
  return "text-stone-700";
}

/* ── Flag rule labels ──────────────────────────────────────────────────────
   Plain-English names for the flag rules the backend records verbatim. */
const FLAG_RULE_LABELS: Record<string, string> = {
  manual: "Staff report",
  signup_ip: "Matching sign-up IP",
  cancelled_streak: "Repeated cancelled orders",
  failed_logins: "Repeated failed sign-ins",
};

/** Label for a flag rule; unknown rules de-snake-case, blank stays blank. */
export function flagRuleLabel(rule: string | null | undefined): string {
  const raw = (rule ?? "").trim().toLowerCase();
  if (!raw) return "";
  const known = FLAG_RULE_LABELS[raw];
  if (known) return known;
  return raw
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** One-line, human-readable summary of an arbitrary meta payload. */
export function metaSummary(meta: ActivityMeta): string {
  if (meta === null || meta === undefined || meta === "") return "—";
  if (typeof meta === "string") {
    const trimmed = meta.trim();
    if (!trimmed) return "—";
    // Meta often serializes JSON as a string — unwrap when possible.
    try {
      return metaSummary(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  if (Array.isArray(meta)) {
    const parts = meta
      .map((entry) => metaSummary(entry as ActivityMeta))
      .filter((part) => part && part !== "—");
    return parts.length ? parts.join(" • ") : "—";
  }
  if (typeof meta === "object") {
    const parts = Object.entries(meta as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => {
        const rendered =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${key}: ${rendered}`;
      });
    return parts.length ? parts.join(" • ") : "—";
  }
  const rendered = String(meta);
  return rendered || "—";
}
