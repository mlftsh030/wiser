/**
 * The persistence implementation used in the deployed product.
 *
 * The browser posts the finished record to our own serverless function and
 * knows nothing else. It holds no credentials, no spreadsheet id and no
 * provider details, which is the whole point: a token that can write to the
 * internal record must never be shipped to a client.
 *
 * Saving is best effort by design. This record is for analysis, not for the
 * customer, so a failure here must never cost them their result or their PDF.
 * The caller is told what happened and decides what, if anything, to show.
 */

import type { ReportModel } from '../../models/results';
import { toRecord } from './recordMapper';
import type { AssessmentRepository, SaveOutcome } from './types';

const ENDPOINT = '/api/assessments';
const TIMEOUT_MS = 6000;

export class SpreadsheetRepository implements AssessmentRepository {
  private readonly endpoint: string;

  constructor(endpoint: string = ENDPOINT) {
    this.endpoint = endpoint;
  }

  async save(report: ReportModel): Promise<SaveOutcome> {
    const record = toRecord(report);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(record),
      });

      if (response.status === 501) {
        // The function is deployed but no spreadsheet is configured. That is a
        // valid way to run the product, so it is not an error.
        return { status: 'not_configured' };
      }
      if (!response.ok) {
        return { status: 'failed', reason: `Request failed with status ${response.status}` };
      }
      return { status: 'saved' };
    } catch (error) {
      // Covers the local dev case where no function is running at all.
      return {
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Network request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Used when persistence is switched off entirely, and in tests. Having a real
 * no-op means the calling code never needs a null check.
 */
export class NoopRepository implements AssessmentRepository {
  async save(): Promise<SaveOutcome> {
    return { status: 'not_configured' };
  }
}
