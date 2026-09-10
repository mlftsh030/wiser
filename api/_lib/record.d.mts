/**
 * Types for the serverless record helpers.
 *
 * The function itself is plain JavaScript because Vercel runs api/ without a
 * build step. This declaration exists so the contract test in
 * src/services/__tests__/persistence.test.ts can import it and still typecheck.
 */

export type RecordKey = string;

export const COLUMNS: ReadonlyArray<[RecordKey, string]>;
export const HEADERS: readonly string[];
export const KEYS: readonly RecordKey[];

export type ValidationResult =
  | { ok: true; row: (string | number)[]; error?: undefined }
  | { ok: false; error: string; row?: undefined };

export function validateRecord(body: unknown): ValidationResult;
