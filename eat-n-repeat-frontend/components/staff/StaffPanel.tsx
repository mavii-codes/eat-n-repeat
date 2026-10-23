import type { ReactNode } from "react";

/**
 * Shared staff-portal container styles.
 *
 * Mirrors the Admin Cash Management "Shift History" card (white surface,
 * stone borders, compact header with icon + title + badge/action, compact
 * uppercase table heads) so every staff card/table container looks the same.
 *
 * Staff-scoped on purpose: the Admin portal keeps using its own AdminPanel,
 * so nothing here changes admin rendering. Pages should compose these class
 * constants instead of re-inventing card/table styles per section.
 */

/** Card shell: white, rounded-xl, soft border + shadow, clipped corners. */
export const staffCard =
  "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";

/** Card header row: icon + title (+badge) left, action right. */
export const staffCardHeader =
  "p-4 border-b border-stone-100 flex flex-wrap justify-between items-center gap-3 bg-stone-50/50";

/** Table header strip (apply to <tr> inside <thead>). */
export const staffThead =
  "bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider";

/** Table header cell. Append text-center / text-right where needed. */
export const staffTh = "px-2.5 py-2.5";

/** Table body cell. */
export const staffTd = "px-2.5 py-2.5";

/** Table body row hover. Tbody should carry `divide-y divide-stone-100`. */
export const staffRow = "hover:bg-stone-50 transition-colors";

/** Empty-state cell / block: centered, quiet, bold small text. */
export const staffEmptyCell = "p-10 text-center text-stone-400 font-bold text-sm";

/** Compact filter/search control (select, input, date). */
export const staffControl =
  "py-2 px-3 text-xs font-bold rounded-lg border border-stone-200 bg-white text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]/40";

/** Quiet action link/button style used in card headers (e.g. "View all"). */
export const staffHeaderAction =
  "text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer";

type StaffPanelProps = {
  /** Lucide icon element, sized/colored by the caller (h-5 w-5 text-[#800000]). */
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional pill rendered next to the title (e.g. a StaffBadge). */
  badge?: ReactNode;
  /** Optional right-aligned header action (button/link). */
  action?: ReactNode;
  children: ReactNode;
};

/** Card with the Shift History header layout. Body padding is caller-managed. */
export function StaffPanel({
  icon,
  title,
  subtitle,
  badge,
  action,
  children,
}: StaffPanelProps) {
  return (
    <section className={staffCard}>
      <div className={staffCardHeader}>
        <div className="flex items-center gap-2 min-w-0">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-stone-800">{title}</h2>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const badgeTones = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-300",
  amber: "bg-amber-100 text-amber-800 border-amber-300",
  red: "bg-rose-100 text-rose-800 border-rose-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  purple: "bg-purple-100 text-purple-800 border-purple-300",
  teal: "bg-teal-100 text-teal-800 border-teal-300",
  stone: "bg-stone-100 text-stone-600 border-stone-300",
} as const;

export type StaffBadgeTone = keyof typeof badgeTones;

/** Small uppercase status pill, same shape/weight as the Shift History badge. */
export function StaffBadge({
  tone = "stone",
  children,
}: {
  tone?: StaffBadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}
