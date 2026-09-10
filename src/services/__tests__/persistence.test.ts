import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../reportBuilder';
import { TemplateExplanationService } from '../explanation/TemplateExplanationService';
import { RemoteExplanationService } from '../explanation/RemoteExplanationService';
import { NoopRepository, SpreadsheetRepository } from '../storage/SpreadsheetRepository';
import { EXPORT_COLUMNS, toRecord } from '../storage/recordMapper';
import { downloadReportPdf } from '../report';
import { validateRecord, KEYS, HEADERS } from '../../../api/_lib/record.mjs';
import { make } from '../../calculations/__tests__/fixtures';

const template = new TemplateExplanationService();
const report = () => buildReport(make({}), { explanationService: template });

/** A record whose id matches what the app actually generates. */
const validRecord = async () => toRecord(await buildReport(make({ id: 'D2942158' }), {
  explanationService: template,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('spreadsheet record', () => {
  it('maps the assessment into every declared column', async () => {
    const record = toRecord(await report());
    for (const column of EXPORT_COLUMNS) {
      expect(record[column.key], `missing column: ${String(column.key)}`).toBeDefined();
    }
  });

  it('records all three scenario results, not just the base case', async () => {
    const built = await report();
    const record = toRecord(built);

    const [conservative, base, optimistic] = built.metrics.scenarios;
    expect(record.conservative_favours).toBe(conservative.outcome.favours);
    expect(record.base_favours).toBe(base.outcome.favours);
    expect(record.optimistic_favours).toBe(optimistic.outcome.favours);
    expect(record.base_net_advantage).toBe(Math.round(base.outcome.netAdvantageOfBuying));
  });

  it('keeps raw inputs distinct from calculated outputs', async () => {
    const record = toRecord(await report());
    // Echoed exactly as entered.
    expect(record.property_price).toBe(1_800_000);
    expect(record.income).toBe(60_000);
    // Derived, not echoed.
    expect(record.monthly_bond).toBeGreaterThan(0);
    expect(record.recommendation).toMatch(/BUYING|RENT/);
  });

  it('contains no personally identifying information', async () => {
    const record = await validRecord();
    const keys = Object.keys(record);

    for (const forbidden of [
      'name',
      'surname',
      'email',
      'phone',
      'mobile',
      'address',
      'id_number',
      'passport',
      'birth',
      'employer',
      'bank',
      'card',
    ]) {
      expect(
        keys.some((key) => key.toLowerCase().includes(forbidden)),
        `record must not contain a field like "${forbidden}"`,
      ).toBe(false);
    }

    // The reference is the only identifier, and it is random rather than
    // derived from anything the customer told us.
    expect(record.assessment_id).toBe('D2942158');
  });

  it('keeps the client column list and the serverless column list in step', () => {
    // The function cannot import from src/, so the two lists are maintained
    // separately. This is what stops them drifting apart silently.
    expect(KEYS).toEqual(EXPORT_COLUMNS.map((column) => column.key));
    expect(HEADERS).toEqual(EXPORT_COLUMNS.map((column) => column.header));
  });
});

describe('server-side record validation', () => {
  it('accepts a record produced by the client', async () => {
    const result = validateRecord(await validRecord());
    if (!result.ok) throw new Error(`expected a valid record: ${result.error}`);
    expect(result.row).toHaveLength(KEYS.length);
  });

  it('rejects a payload carrying personal information', async () => {
    const record = { ...(await validRecord()), email: 'someone@example.com' };
    const result = validateRecord(record);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown fields rather than writing them to the sheet', async () => {
    const result = validateRecord({ ...(await validRecord()), injected: 'anything' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unexpected field');
  });

  it('rejects an invalid recommendation', async () => {
    const result = validateRecord({ ...(await validRecord()), recommendation: 'BUY_NOW' });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-finite number', async () => {
    const result = validateRecord({ ...(await validRecord()), monthly_bond: Infinity });
    expect(result.ok).toBe(false);
  });

  it('neutralises text that a spreadsheet would treat as a formula', async () => {
    const record = { ...(await validRecord()), primary_reason: '=HYPERLINK("http://x","x")' };
    const result = validateRecord(record);
    if (!result.ok) throw new Error(`expected a valid record: ${result.error}`);
    const value = result.row[KEYS.indexOf('primary_reason')];
    expect(String(value).startsWith("'=")).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    expect(validateRecord(null).ok).toBe(false);
    expect(validateRecord('a string').ok).toBe(false);
    expect(validateRecord([]).ok).toBe(false);
  });
});

describe('persistence never blocks the customer', () => {
  it('reports a failure instead of throwing when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const outcome = await new SpreadsheetRepository().save(await report());
    expect(outcome.status).toBe('failed');
  });

  it('treats an unconfigured spreadsheet as expected, not as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 501 }));
    const outcome = await new SpreadsheetRepository().save(await report());
    expect(outcome.status).toBe('not_configured');
  });

  it('reports a server error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const outcome = await new SpreadsheetRepository().save(await report());
    expect(outcome.status).toBe('failed');
  });

  it('confirms a successful write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }));
    const outcome = await new SpreadsheetRepository().save(await report());
    expect(outcome.status).toBe('saved');
  });

  it('still produces the customer PDF when the spreadsheet write fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('spreadsheet unavailable')));
    const built = await report();

    const outcome = await new SpreadsheetRepository().save(built);
    expect(outcome.status).toBe('failed');

    // The PDF is built from the report already in memory, so a failed write
    // cannot touch it.
    const clicked = vi.fn();
    stubDownloadEnvironment(clicked);
    await expect(downloadReportPdf(built)).resolves.toBeUndefined();
    expect(clicked).toHaveBeenCalled();
  });

  it('the no-op repository satisfies the interface without doing anything', async () => {
    expect((await new NoopRepository().save()).status).toBe('not_configured');
  });
});

describe('AI failure still produces a valid report', () => {
  it('falls back to the template when the explanation function is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Gemini unavailable')));

    const service = new RemoteExplanationService();
    const built = await buildReport(make({}), { explanationService: service });

    expect(built.explanationSource).toBe('template');
    expect(built.explanation.length).toBeGreaterThan(50);
    expect(built.decision.recommendation).toBeTruthy();
    expect(built.metrics.mortgage.monthlyPayment).toBeGreaterThan(0);
  });

  it('falls back when the function reports that AI is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ used: false, reason: 'not_configured' }),
      }),
    );

    const service = new RemoteExplanationService();
    const built = await buildReport(make({}), { explanationService: service });
    expect(built.explanationSource).toBe('template');
    expect(built.explanation.length).toBeGreaterThan(50);
  });

  it('uses the AI narrative when the function returns one', async () => {
    const narrative = 'A'.repeat(200);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ used: true, explanation: narrative }),
      }),
    );

    const service = new RemoteExplanationService();
    const built = await buildReport(make({}), { explanationService: service });
    expect(built.explanationSource).toBe('ai');
    expect(built.explanation).toBe(narrative);
  });

  it('never lets the AI change the recommendation or the numbers', async () => {
    const deterministic = await buildReport(make({}), { explanationService: template });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ used: true, explanation: 'B'.repeat(200) }),
      }),
    );
    const withAi = await buildReport(make({}), { explanationService: new RemoteExplanationService() });

    expect(withAi.decision.recommendation).toBe(deterministic.decision.recommendation);
    expect(withAi.metrics.scores).toEqual(deterministic.metrics.scores);
    expect(withAi.metrics.baseOutcome).toEqual(deterministic.metrics.baseOutcome);
  });

  it('does not send the customer raw inputs to the explanation service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ used: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await buildReport(make({ monthlyIncome: 123_456 }), {
      explanationService: new RemoteExplanationService(),
    });

    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).not.toContain('123456');
    expect(body).not.toContain('monthlyIncome');
  });
});

/** Minimal browser stubs so the download path can run under Node. */
function stubDownloadEnvironment(clicked: () => void): void {
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => undefined,
  });
  vi.stubGlobal('window', {
    document: {
      createElement: () => ({
        set href(_value: string) {},
        set download(_value: string) {},
        click: clicked,
      }),
    },
  });
}
