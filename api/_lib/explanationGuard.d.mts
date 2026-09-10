/**
 * Types for the explanation guard. The implementation is plain JavaScript
 * because Vercel runs api/ with no build step; this declaration lets the tests
 * import it and still typecheck.
 */

export const MIN_LENGTH: number;
export const MAX_LENGTH: number;

export type GuardResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export function validateExplanation(text: unknown, recommendation: unknown): GuardResult;
