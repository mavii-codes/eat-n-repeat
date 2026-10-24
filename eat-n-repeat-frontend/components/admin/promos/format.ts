/* Promo Codes — display helpers. Calm, grounded English; ₱ only; every
   backend message lands verbatim (formatting never rewrites text). */

/** Short date for table cells: "Oct 23, 2026" (— when missing/invalid). */
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

/* Date + short time for updated rows: "Oct 23, 2026, 2:05 PM". */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

/** One cell: "10% off · capped ₱50.00 · min ₱200.00" or "₱25 off". */
export function discountSummary(row: {
  type: string;
  value: string;
  max_discount?: string | null;
  min_order?: string | null;
}): string {
  const num = Number(row.value);
  let head: string;
  if ((row.type || "").toUpperCase() === "PERCENT" && Number.isFinite(num)) {
    head = `${num % 1 === 0 ? num.toString() : num.toFixed(2)}% off`;
  } else if (Number.isFinite(num)) {
    head = `₱${num.toFixed(2)} off`;
  } else {
    head = row.value;
  }
  const bits: string[] = [head];
  const max = Number(row.max_discount ?? 0);
  if (row.max_discount != null && max > 0) bits.push(`capped ₱${max.toFixed(2)}`);
  const min = Number(row.min_order ?? 0);
  if (row.min_order != null && min > 0) bits.push(`min ₱${min.toFixed(2)}`);
  return bits.join(" · ");
}
