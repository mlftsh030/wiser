/**
 * Types for the Google Sheets helpers. The implementation is plain JavaScript
 * because Vercel runs api/ with no build step; this declaration lets the tests
 * import it and still typecheck.
 */

export const DEFAULT_SHEET_NAME: string;

export interface SheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
  sheetName: string;
}

export function normalisePrivateKey(rawKey: unknown): string;
export function readSheetsConfig(env?: Record<string, string | undefined>): SheetsConfig | null;
export function appendRow(config: SheetsConfig, row: (string | number)[]): Promise<unknown>;
