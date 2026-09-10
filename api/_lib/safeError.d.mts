/**
 * Types for the safe error helpers. The implementation is plain JavaScript
 * because Vercel runs api/ with no build step; this declaration lets the tests
 * import it and still typecheck.
 */

export function scrub(text: unknown): string;
export function describeError(error: unknown): string;
