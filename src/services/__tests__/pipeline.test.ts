import { describe, expect, it } from 'vitest';
import { buildReport } from '../reportBuilder';
import { TemplateExplanationService } from '../explanation/TemplateExplanationService';
import { toRecord, EXPORT_COLUMNS } from '../storage/recordMapper';
import { make } from '../../calculations/__tests__/fixtures';
import type { ExplanationService } from '../explanation/types';

const template = new TemplateExplanationService();

describe('report pipeline', () => {
  it('produces a complete report from an assessment', async () => {
    const report = await buildReport(make({}), { explanationService: template });
    expect(report.decision.recommendation).toBeTruthy();
    expect(report.metrics.scenarios).toHaveLength(3);
    expect(report.explanation.length).toBeGreaterThan(50);
    expect(report.explanationSource).toBe('template');
  });

  it('still returns a report when the explanation service fails', async () => {
    // The narrative is presentation. A failure here must not cost the customer
    // their numbers.
    const broken: ExplanationService = {
      source: 'ai',
      explain: async () => {
        throw new Error('AI unavailable');
      },
    };
    const report = await buildReport(make({}), { explanationService: broken });
    expect(report.explanation).toBe(report.decision.summary);
    expect(report.explanationSource).toBe('template');
    expect(report.metrics.mortgage.monthlyPayment).toBeGreaterThan(0);
  });

  it('is deterministic - identical inputs give an identical recommendation', async () => {
    const assessment = make({});
    const [a, b] = await Promise.all([
      buildReport(assessment, { explanationService: template }),
      buildReport(assessment, { explanationService: template }),
    ]);
    expect(a.decision.recommendation).toBe(b.decision.recommendation);
    expect(a.metrics.scores).toEqual(b.metrics.scores);
  });

  it('labels an assumed interest rate so the report can disclose it', async () => {
    const report = await buildReport(make({ interestRate: null }), {
      explanationService: template,
    });
    expect(report.metrics.mortgage.usedDefaultRate).toBe(true);
    expect(report.metrics.mortgage.annualRate).toBeGreaterThan(0);
  });
});

describe('export record', () => {
  it('maps every declared column to a defined value', async () => {
    const report = await buildReport(make({}), { explanationService: template });
    const record = toRecord(report);
    for (const column of EXPORT_COLUMNS) {
      expect(record[column.key], `missing column: ${String(column.key)}`).toBeDefined();
    }
  });

  it('contains no personally identifying fields', async () => {
    const report = await buildReport(make({}), { explanationService: template });
    const keys = Object.keys(toRecord(report));
    for (const forbidden of ['name', 'email', 'phone', 'id_number', 'address', 'surname']) {
      expect(keys.some((key) => key.includes(forbidden))).toBe(false);
    }
  });

  it('separates raw inputs from calculated outputs', async () => {
    const report = await buildReport(make({}), { explanationService: template });
    const record = toRecord(report);
    // Raw input preserved exactly as entered.
    expect(record.property_price).toBe(1_800_000);
    // Derived value computed, not echoed.
    expect(record.monthly_bond).toBeGreaterThan(0);
    expect(record.recommendation).toMatch(/BUYING|RENT/);
  });

  it('preserves all selected priorities rather than only the first', async () => {
    const report = await buildReport(
      make({ priorities: ['build_wealth', 'flexibility', 'own_asset'] }),
      { explanationService: template },
    );
    expect(toRecord(report).primary_priority).toBe('build_wealth; flexibility; own_asset');
  });
});
