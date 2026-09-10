/**
 * Minimal Google Sheets client for appending one row.
 *
 * Uses a service account, which is the simplest credential that works without
 * a human being present to complete an OAuth flow. The private key never
 * leaves the server: it is read from a Vercel environment variable inside the
 * function, and nothing about it is ever sent to the browser.
 *
 * The sheet is Excel-compatible. It opens in Excel directly and exports to
 * .xlsx from the File menu, which is what the internal record needs to be.
 */

import { JWT } from 'google-auth-library';
import { HEADERS } from './record.mjs';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const DEFAULT_SHEET_NAME = 'Assessments';

/**
 * Normalises a private key pasted into an environment variable.
 *
 * A PEM key is multi-line, but an environment variable is a single string, so
 * what actually arrives varies by how it was pasted:
 *
 *  - from a JSON key file, newlines are the two characters backslash-n
 *  - some UIs and shells wrap the whole value in quotes
 *  - a value pasted from a file may carry real newlines already, or CRLF
 *
 * All of those must end up as a real LF-separated PEM block, because the JWT
 * signer rejects anything else. Handling every case here is what stops the
 * classic "invalid PEM formatted message" failure on first deploy.
 *
 * The key is only ever transformed in memory. It is never written to disk,
 * never logged, and never returned to a caller.
 */
export function normalisePrivateKey(rawKey) {
  if (typeof rawKey !== 'string') return '';

  let key = rawKey.trim();

  // Strip a single layer of wrapping quotes, if present.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  return key
    // Escaped newlines, as they appear in a JSON key file.
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    // Real carriage returns, from a Windows paste.
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Reads configuration from the environment.
 *
 * Returns null when the integration is not configured. That is a supported way
 * to run the product, not a failure: the app works without it and the customer
 * still gets their PDF.
 */
export function readSheetsConfig(env = process.env) {
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalisePrivateKey(env.GOOGLE_PRIVATE_KEY);

  if (!spreadsheetId || !clientEmail || !privateKey) return null;

  return {
    spreadsheetId,
    clientEmail,
    privateKey,
    sheetName: env.GOOGLE_SHEET_NAME || DEFAULT_SHEET_NAME,
  };
}

function client(config) {
  return new JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: [SCOPE],
  });
}

/**
 * Appends a row, writing the header row first if the sheet is empty.
 *
 * Append is a single API call and Sheets serialises concurrent appends itself,
 * so unlike a local workbook there is no read-modify-write race to guard
 * against here.
 */
export async function appendRow(config, row) {
  const auth = client(config);
  const range = `${config.sheetName}!A1`;

  await ensureHeaderRow(auth, config);

  const response = await auth.request({
    url: `${API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(
      range,
    )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    method: 'POST',
    data: { values: [row] },
  });

  return response.data;
}

async function ensureHeaderRow(auth, config) {
  const range = `${config.sheetName}!A1:A1`;
  const response = await auth.request({
    url: `${API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(range)}`,
    method: 'GET',
  });

  const hasHeader = Array.isArray(response.data?.values) && response.data.values.length > 0;
  if (hasHeader) return;

  await auth.request({
    url: `${API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(
      `${config.sheetName}!A1`,
    )}?valueInputOption=RAW`,
    method: 'PUT',
    data: { values: [HEADERS] },
  });
}
