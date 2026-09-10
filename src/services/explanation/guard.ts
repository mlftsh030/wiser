/**
 * Validation for AI-generated explanation text, on the client.
 *
 * This mirrors api/_lib/explanationGuard.mjs deliberately. The serverless
 * function already rejects unacceptable output, so this is a second line of
 * defence rather than the first: it means nothing can reach a customer
 * unchecked even if the endpoint is misconfigured, replaced, or intercepted.
 *
 * It is the same reasoning as validating the record server-side when the
 * client already produces a clean one. The check is cheap and the failure it
 * prevents is one a customer would actually be misled by.
 */

import type { Recommendation } from '../../models/results';

export const MIN_LENGTH = 80;
export const MAX_LENGTH = 2000;

const URGES_BUYING = [
  /\byou should buy\b/,
  /\bgo ahead and buy\b/,
  /\bbuying is the right\b/,
  /\bwe recommend buying\b/,
  /\bour recommendation is to buy\b/,
  /\byou ought to buy\b/,
  /\bbuy(ing)? is recommended\b/,
];

const URGES_RENTING = [
  /\byou should rent\b/,
  /\byou cannot afford\b/,
  /\bdo not buy\b/,
  /\bdon't buy\b/,
  /\bwe recommend renting\b/,
  /\bour recommendation is to rent\b/,
  /\byou ought to rent\b/,
  /\brent(ing)? is recommended\b/,
];

const GUARANTEES = [
  /\bguarantee(d|s)?\b/,
  /\bwill definitely\b/,
  /\bcertain to\b/,
  /\brisk[\s-]?free\b/,
  /\bno risk\b/,
  /\bcan'?t lose\b/,
  /\bcannot lose\b/,
  /\bsure thing\b/,
  /\bpromise(d|s)?\b/,
];

const matchesAny = (patterns: RegExp[], text: string): boolean =>
  patterns.some((pattern) => pattern.test(text));

/** The hedged answer constrains both directions, since either would overstate it. */
function disqualifying(recommendation: Recommendation): RegExp[] | null {
  switch (recommendation) {
    case 'RENT_FOR_NOW':
      return URGES_BUYING;
    case 'BUYING_LOOKS_ATTRACTIVE':
      return URGES_RENTING;
    case 'BUYING_MAY_WORK':
      return [...URGES_BUYING, ...URGES_RENTING];
    default:
      return null;
  }
}

/**
 * `reason` is declared optional on the success branch so a caller can read it
 * without narrowing first. It is only ever set when validation fails.
 */
export type GuardResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export function validateExplanation(text: unknown, recommendation: Recommendation): GuardResult {
  if (typeof text !== 'string') return { ok: false, reason: 'not_text' };

  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length < MIN_LENGTH) return { ok: false, reason: 'too_short' };
  if (trimmed.length > MAX_LENGTH) return { ok: false, reason: 'too_long' };

  const forbidden = disqualifying(recommendation);
  if (forbidden === null) return { ok: false, reason: 'unknown_recommendation' };

  const lower = trimmed.toLowerCase();
  if (matchesAny(forbidden, lower)) return { ok: false, reason: 'contradicts_recommendation' };
  if (matchesAny(GUARANTEES, lower)) return { ok: false, reason: 'guarantee_language' };

  return { ok: true };
}
