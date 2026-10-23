/** Revenue change copy shared by the admin dashboard and reports cards. */
export function formatPctChange(value: number | null): string {
  if (value == null) return "no sales yesterday";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}% from yesterday`;
}

/** Positive changes stay green; negative changes use the rose tone. */
export function pctChangeToneClassName(value: number | null): string | undefined {
  if (value == null) return undefined;
  return value >= 0 ? "text-emerald-700" : "text-rose-600";
}
