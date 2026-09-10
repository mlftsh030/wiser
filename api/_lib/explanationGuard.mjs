/**
 * Validation for AI-generated explanation text.
 *
 * Gemini output is untrusted generated text. It is checked here before it can
 * ever reach a customer, and anything that fails falls back to the
 * deterministic template.
 *
 * Prose cannot be verified rigorously, so this does not try. It rejects the
 * failure modes that would actually mislead someone: output of the wrong
 * shape, output that recommends the opposite of what the engine decided, and
 * output that promises an outcome. Everything else is a wording change, which
 * is the only thing this layer is allowed to make.
 *
 * Kept separate from the handler so it can be tested directly.
 */

/** Below this the output is not an explanation; above it, it is not a summary. */
export const MIN_LENGTH = 80;
export const MAX_LENGTH = 2000;

/**
 * Phrases that assert the customer should buy, and phrases that assert they
 * should rent. Which set is disqualifying depends on the recommendation.
 *
 * These are deliberately phrases of instruction rather than single words:
 * an explanation of a "rent for now" result should be free to discuss buying,
 * and often must. What it may not do is tell the customer to go and do it.
 */
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

/** A decision-support tool may never promise an outcome. */
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

const matchesAny = (patterns, text) => patterns.some((pattern) => pattern.test(text));

/**
 * Which direction the text must not urge, for each recommendation.
 *
 * Note that the hedged answer constrains both directions. It is the case where
 * a confident sentence in either direction would misrepresent the engine, and
 * leaving it unconstrained was the gap this table closes.
 */
function disqualifying(recommendation) {
  switch (recommendation) {
    case 'RENT_FOR_NOW':
      return URGES_BUYING;
    case 'BUYING_LOOKS_ATTRACTIVE':
      return URGES_RENTING;
    case 'BUYING_MAY_WORK':
      return [...URGES_BUYING, ...URGES_RENTING];
    default:
      // An unrecognised recommendation is not something we will narrate.
      return null;
  }
}

/**
 * Returns { ok: true } or { ok: false, reason }.
 *
 * The reason is for our logs and for tests. It is never shown to a customer,
 * who simply receives the deterministic explanation instead.
 */
export function validateExplanation(text, recommendation) {
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
