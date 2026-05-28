/**
 * Format a number as Indian Rupees.
 * e.g. formatINR(1299.5) → "₹1,299.50"
 */
export function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
