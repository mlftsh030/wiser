/**
 * Writes one assessment record to the online spreadsheet.
 *
 * This is the only place that holds spreadsheet credentials. The browser posts
 * a validated record and receives nothing back but a status, so no client ever
 * holds a token capable of modifying the sheet.
 *
 * The customer's result and PDF do not depend on this succeeding. Every
 * failure path returns a status the client can ignore.
 */

import { describeError } from './_lib/safeError.mjs';
import { validateRecord } from './_lib/record.mjs';
import { appendRow, readSheetsConfig } from './_lib/sheets.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const config = readSheetsConfig();
  if (!config) {
    // Running without the integration configured is a supported deployment.
    // 501 tells the client this is expected rather than broken.
    return response.status(501).json({ status: 'not_configured' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ error: 'Body is not valid JSON.' });
    }
  }

  const validation = validateRecord(body);
  if (!validation.ok) {
    return response.status(400).json({ error: validation.error });
  }

  try {
    await appendRow(config, validation.row);
    return response.status(201).json({ status: 'saved' });
  } catch (error) {
    // Log a scrubbed one-line summary, never the error object itself: an auth
    // or HTTP client error carries the failed request, which can include the
    // signed assertion our private key produced.
    console.error('Failed to append assessment record:', describeError(error));
    // Stay vague to the caller. The client cannot act on the detail, and the
    // detail may name internal configuration.
    return response.status(502).json({ status: 'failed' });
  }
}
