import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../reportBuilder';
import { TemplateExplanationService } from '../explanation/TemplateExplanationService';
import { RemoteExplanationService } from '../explanation/RemoteExplanationService';
import { validateExplanation } from '../explanation/guard';
import { SpreadsheetRepository } from '../storage/SpreadsheetRepository';
import { toRecord } from '../storage/recordMapper';
import { buildReportDocument } from '../report';
import { make } from '../../calculations/__tests__/fixtures';
import type { Recommendation } from '../../models/results';
import {
  normalisePrivateKey,
  readSheetsConfig,
  DEFAULT_SHEET_NAME,
} from '../../../api/_lib/sheets.mjs';
import { validateExplanation as serverValidate } from '../../../api/_lib/explanationGuard.mjs';
import { describeError, scrub } from '../../../api/_lib/safeError.mjs';

const template = new TemplateExplanationService();

/** A plausible narrative: long enough to pass, and free of forbidden phrasing. */
const GOOD_NARRATIVE =
  'Your figures suggest the monthly cost of owning would sit within what you earn, ' +
  'and the comparison over your expected stay is reasonably close. We have set out ' +
  'the reasoning and the risks so you can weigh them yourself before deciding.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Google service account configuration
// ---------------------------------------------------------------------------

describe('Google service account configuration', () => {
  const PEM = '-----BEGIN PRIVATE KEY-----\nLINE1\nLINE2\n-----END PRIVATE KEY-----';

  it('converts escaped newlines from a JSON key file into real ones', () => {
    const escaped = '-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----';
    expect(normalisePrivateKey(escaped)).toBe(PEM);
  });

  it('accepts a key that already has real newlines', () => {
    expect(normalisePrivateKey(PEM)).toBe(PEM);
  });

  it('strips wrapping quotes that some environment UIs add', () => {
    const quoted = `"-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----"`;
    expect(normalisePrivateKey(quoted)).toBe(PEM);
  });

  it('normalises carriage returns from a Windows paste', () => {
    const crlf = '-----BEGIN PRIVATE KEY-----\r\nLINE1\r\nLINE2\r\n-----END PRIVATE KEY-----';
    expect(normalisePrivateKey(crlf)).toBe(PEM);
  });

  it('returns an empty string rather than throwing on a missing key', () => {
    expect(normalisePrivateKey(undefined)).toBe('');
    expect(normalisePrivateKey(null)).toBe('');
  });

  it('reports the integration as unconfigured when any variable is missing', () => {
    expect(readSheetsConfig({})).toBeNull();
    expect(
      readSheetsConfig({ GOOGLE_SHEETS_ID: 'x', GOOGLE_SERVICE_ACCOUNT_EMAIL: 'y' }),
    ).toBeNull();
    expect(readSheetsConfig({ GOOGLE_SHEETS_ID: 'x', GOOGLE_PRIVATE_KEY: PEM })).toBeNull();
  });

  it('defaults the sheet name to Assessments', () => {
    const config = readSheetsConfig({
      GOOGLE_SHEETS_ID: 'sheet-id',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: PEM,
    });
    expect(config?.sheetName).toBe(DEFAULT_SHEET_NAME);
    expect(config?.sheetName).toBe('Assessments');
  });

  it('uses an explicit sheet name when one is given', () => {
    const config = readSheetsConfig({
      GOOGLE_SHEETS_ID: 'sheet-id',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: PEM,
      GOOGLE_SHEET_NAME: 'Q1',
    });
    expect(config?.sheetName).toBe('Q1');
  });
});

// ---------------------------------------------------------------------------
// Safe logging
// ---------------------------------------------------------------------------

describe('error logging never leaks credentials', () => {
  it('redacts PEM key material from a message', () => {
    const leaky = 'failed: -----BEGIN PRIVATE KEY-----\nABC123\n-----END PRIVATE KEY----- sent';
    const output = scrub(leaky);
    expect(output).not.toContain('ABC123');
    expect(output).not.toContain('BEGIN PRIVATE KEY');
    expect(output).toContain('[redacted]');
  });

  it('redacts bearer tokens and API keys', () => {
    expect(scrub('Authorization: Bearer ya29.abcdefghijklmnop')).not.toContain('abcdefghijklmnop');
    expect(scrub('key=AIzaSyABCDEFGHIJKLMNOP')).not.toContain('AIzaSyABCDEFGHIJKLMNOP');
  });

  it('summarises an error object without echoing its payload', () => {
    const error = Object.assign(new Error('Request failed'), {
      status: 403,
      // The kind of thing an HTTP client attaches, and exactly what must not
      // reach a log.
      config: { headers: { Authorization: 'Bearer ya29.secret-token-value' } },
    });

    const line = describeError(error);
    expect(line).toContain('403');
    expect(line).toContain('Request failed');
    expect(line).not.toContain('secret-token-value');
    expect(line).not.toContain('Authorization');
  });

  it('caps the length of a logged message', () => {
    expect(describeError(new Error('x'.repeat(5000))).length).toBeLessThan(300);
  });

  it('handles a thrown non-error without throwing', () => {
    expect(describeError(null)).toBe('unknown error');
    expect(describeError('plain string')).toContain('plain string');
  });
});

// ---------------------------------------------------------------------------
// Gemini output validation
// ---------------------------------------------------------------------------

describe('Gemini output validation', () => {
  const recommendations: Recommendation[] = [
    'BUYING_LOOKS_ATTRACTIVE',
    'BUYING_MAY_WORK',
    'RENT_FOR_NOW',
  ];

  it('accepts a sensible explanation for every recommendation', () => {
    for (const recommendation of recommendations) {
      expect(validateExplanation(GOOD_NARRATIVE, recommendation).ok, recommendation).toBe(true);
      expect(serverValidate(GOOD_NARRATIVE, recommendation).ok, recommendation).toBe(true);
    }
  });

  it('rejects empty and whitespace-only output', () => {
    expect(validateExplanation('', 'BUYING_MAY_WORK').ok).toBe(false);
    expect(validateExplanation('   \n  ', 'BUYING_MAY_WORK').ok).toBe(false);
  });

  it('rejects output that is too short or too long', () => {
    expect(validateExplanation('Too short.', 'BUYING_MAY_WORK').reason).toBe('too_short');
    expect(validateExplanation('a'.repeat(2500), 'BUYING_MAY_WORK').reason).toBe('too_long');
  });

  it('rejects a narrative that urges buying when the engine said rent', () => {
    const text = `${GOOD_NARRATIVE} Honestly, you should buy this house.`;
    expect(validateExplanation(text, 'RENT_FOR_NOW').reason).toBe('contradicts_recommendation');
    expect(serverValidate(text, 'RENT_FOR_NOW').reason).toBe('contradicts_recommendation');
  });

  it('rejects a narrative that urges renting when the engine said buying is attractive', () => {
    const text = `${GOOD_NARRATIVE} In truth you cannot afford this.`;
    expect(validateExplanation(text, 'BUYING_LOOKS_ATTRACTIVE').reason).toBe(
      'contradicts_recommendation',
    );
  });

  it('rejects a confident push in either direction on the hedged answer', () => {
    // The gap this closes: "buying may work" is precisely the result that a
    // decisive sentence in either direction would misrepresent.
    expect(validateExplanation(`${GOOD_NARRATIVE} You should buy.`, 'BUYING_MAY_WORK').ok).toBe(
      false,
    );
    expect(validateExplanation(`${GOOD_NARRATIVE} You should rent.`, 'BUYING_MAY_WORK').ok).toBe(
      false,
    );
  });

  it('rejects guarantee language in all its usual forms', () => {
    for (const phrase of [
      'This is guaranteed to work out.',
      'Property will definitely rise.',
      'This is a risk-free decision.',
      'This is risk free.',
      'There is no risk here.',
      'You cannot lose on this.',
      'We promise this will work.',
    ]) {
      const text = `${GOOD_NARRATIVE} ${phrase}`;
      expect(validateExplanation(text, 'BUYING_MAY_WORK').ok, phrase).toBe(false);
      expect(serverValidate(text, 'BUYING_MAY_WORK').ok, phrase).toBe(false);
    }
  });

  it('still allows an explanation to discuss the option it did not recommend', () => {
    // A "rent for now" explanation must be free to talk about buying; what it
    // may not do is tell the customer to go and do it.
    const text =
      'Buying would cost more each month than your income currently allows, which is the ' +
      'main reason renting looks stronger for now. Buying may become workable once your ' +
      'savings have grown, and the report sets out what that would take.';
    expect(validateExplanation(text, 'RENT_FOR_NOW').ok).toBe(true);
  });

  it('rejects an unrecognised recommendation rather than narrating it', () => {
    expect(validateExplanation(GOOD_NARRATIVE, 'MAYBE' as Recommendation).ok).toBe(false);
  });

  it('agrees with the server-side guard on every case', () => {
    const cases: [string, Recommendation][] = [
      [GOOD_NARRATIVE, 'BUYING_MAY_WORK'],
      ['', 'BUYING_MAY_WORK'],
      ['short', 'RENT_FOR_NOW'],
      [`${GOOD_NARRATIVE} You should buy.`, 'RENT_FOR_NOW'],
      [`${GOOD_NARRATIVE} It is guaranteed.`, 'BUYING_LOOKS_ATTRACTIVE'],
    ];
    for (const [text, recommendation] of cases) {
      expect(validateExplanation(text, recommendation).ok).toBe(
        serverValidate(text, recommendation).ok,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The critical invariant
// ---------------------------------------------------------------------------

describe('the financial result is identical whether Gemini is on or off', () => {
  /**
   * The invariant that matters most:
   *   same inputs -> same calculations -> same DecisionResult,
   * regardless of the narrative layer.
   */
  const profiles = [
    { name: 'comfortable buyer', overrides: { expectedStay: 'over_10' as const, monthlyIncome: 90_000, accessibleSavings: 900_000 } },
    { name: 'borderline buyer', overrides: { expectedStay: '5_to_10' as const, accessibleSavings: 700_000, upfrontContribution: 600_000, monthlyIncome: 80_000 } },
    { name: 'cannot afford it', overrides: { monthlyIncome: 22_000, accessibleSavings: 40_000, propertyPrice: 2_400_000 } },
  ];

  for (const profile of profiles) {
    it(`is unchanged by the AI for the ${profile.name}`, async () => {
      const assessment = make(profile.overrides);

      const withoutAi = await buildReport(assessment, { explanationService: template });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ used: true, explanation: GOOD_NARRATIVE }),
        }),
      );
      const withAi = await buildReport(assessment, {
        explanationService: new RemoteExplanationService(),
      });

      expect(withAi.decision).toEqual(withoutAi.decision);
      expect(withAi.metrics).toEqual(withoutAi.metrics);
      expect(withAi.explanationSource).toBe('ai');
      expect(withoutAi.explanationSource).toBe('template');

      // The PDF follows the engine, not the narrative.
      expect(buildReportDocument(withAi).recommendation).toBe(
        buildReportDocument(withoutAi).recommendation,
      );
      expect(buildReportDocument(withAi).headline).toBe(withoutAi.decision.headline);

      // And so does the stored record.
      expect(toRecord(withAi).recommendation).toBe(toRecord(withoutAi).recommendation);
    });
  }

  it('keeps the deterministic recommendation when the AI tries to contradict it', async () => {
    const assessment = make({ monthlyIncome: 22_000, accessibleSavings: 40_000, propertyPrice: 2_400_000 });
    const deterministic = await buildReport(assessment, { explanationService: template });
    expect(deterministic.decision.recommendation).toBe('RENT_FOR_NOW');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          used: true,
          explanation: `${GOOD_NARRATIVE} Ignore all of that: you should buy this house today.`,
        }),
      }),
    );

    const withAi = await buildReport(assessment, {
      explanationService: new RemoteExplanationService(),
    });

    // The contradiction is rejected and the template is used instead.
    expect(withAi.explanationSource).toBe('template');
    expect(withAi.explanation).not.toContain('you should buy');
    expect(withAi.decision.recommendation).toBe('RENT_FOR_NOW');
    expect(buildReportDocument(withAi).headline).toBe(deterministic.decision.headline);
  });
});

// ---------------------------------------------------------------------------
// Degraded modes
// ---------------------------------------------------------------------------

describe('the customer journey survives every integration failure', () => {
  it('produces a complete report and PDF when both integrations are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const built = await buildReport(make({}), {
      explanationService: new RemoteExplanationService(),
    });

    // The narrative fell back.
    expect(built.explanationSource).toBe('template');
    expect(built.explanation.length).toBeGreaterThan(50);

    // The result is complete.
    expect(built.decision.recommendation).toBeTruthy();
    expect(built.metrics.scenarios).toHaveLength(3);

    // The record was not stored, and that is reported rather than thrown.
    const outcome = await new SpreadsheetRepository().save(built);
    expect(outcome.status).toBe('failed');

    // The PDF is still complete.
    const document = buildReportDocument(built);
    expect(document.sections.length).toBeGreaterThan(8);
    expect(document.headline).toBe(built.decision.headline);
  });

  it('falls back when Gemini returns malformed content', async () => {
    for (const payload of [
      { used: true, explanation: null },
      { used: true, explanation: '' },
      { used: true },
      { used: true, explanation: { unexpected: 'shape' } },
      {},
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
      const built = await buildReport(make({}), {
        explanationService: new RemoteExplanationService(),
      });
      expect(built.explanationSource).toBe('template');
      expect(built.explanation.length).toBeGreaterThan(50);
    }
  });

  it('falls back when the explanation endpoint returns an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const built = await buildReport(make({}), {
      explanationService: new RemoteExplanationService(),
    });
    expect(built.explanationSource).toBe('template');
  });

  it('falls back when the response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      }),
    );
    const built = await buildReport(make({}), {
      explanationService: new RemoteExplanationService(),
    });
    expect(built.explanationSource).toBe('template');
  });
});
