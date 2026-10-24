/**
 * Promo money formatting shared by the cart, order cards, and receipts.
 * Backend promo amounts may arrive as strings ("30.00") or numbers.
 */

/** Parse a peso amount (number or decimal string) to a finite number. */
export function parse2(value: string): number {
  const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Render a peso amount with exactly two decimals, e.g. ₱30.00. */
export function displayPeso(value: number | string): string {
  const amount = typeof value === 'number' ? value : parse2(value);
  return `₱${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}
