type LiveChipProps = {
  label?: "Live" | "Updated just now";
};

/**
 * Small live-data indicator for the admin dashboard/reports pages. Kept
 * separate from the page-local inventory chip so both revenue pages stay
 * visually consistent.
 */
export function LiveChip({ label = "Live" }: LiveChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {label}
    </span>
  );
}
