/**
 * Parsing and formatting for the numeric journey inputs.
 *
 * Kept out of the component file so it can be tested directly: the test suite
 * runs in Node with no DOM, and this is the logic that actually decides whether
 * a customer can type a decimal.
 */

/**
 * Accepts spaces, commas and stray currency symbols; returns null when empty.
 *
 * A partial entry, meaning a lone ".", "-" or "-." mid-typing, is null rather
 * than 0. Number() would call each of those 0, which would show the customer a
 * figure they never typed and could quietly pass validation.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s,R]/g, '');
  if (cleaned === '' || /^-?\.?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Thousands separators while typing, without fighting the caret on decimals. */
export function formatForInput(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('en-ZA') : String(value);
}

/**
 * A percentage is entered as 10.76 and stored as 0.1076.
 *
 * Rounding at two decimals on the way out is what stops 10.76 redisplaying as
 * 10.760000000000001 once it has been through a floating point division.
 */
export function formatPercentForInput(fraction: number): string {
  return String(Number((fraction * 100).toFixed(2)));
}

export function parsePercentInput(raw: string): number | null {
  const parsed = parseAmount(raw);
  return parsed === null ? null : parsed / 100;
}
