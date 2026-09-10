/** Display formatting. Kept out of the calculation modules so those stay pure. */

const currency = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return 'R0';
  // Intl renders ZAR as "ZAR 1,234" in some environments; normalise to "R".
  // The thousands separator is kept as a non-breaking space so an amount never
  // wraps across two lines mid-number in a narrow column.
  return currency
    .format(Math.round(value))
    .replace(/^ZAR\s?/, 'R')
    .replace(/[\s,]/g, '\u00a0');
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** "about 2.1 months" - phrased for use inside a sentence. */
export function formatMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return 'less than a month';
  if (months >= 24) return 'over two years';
  if (months < 1) return 'less than a month';
  return `${months.toFixed(1)} months`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 }).format(value);
}
