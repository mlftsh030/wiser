import { describe, expect, it } from 'vitest';
import { buildReport } from '../reportBuilder';
import { TemplateExplanationService } from '../explanation/TemplateExplanationService';
import { buildReportDocument, formatTimestamp } from '../report/reportDocument';
import type { DocumentBlock, ReportDocument } from '../report/reportDocument';
import { make } from '../../calculations/__tests__/fixtures';
import type { Recommendation, ReportModel } from '../../models/results';
import { formatCurrency } from '../../utils/format';

const template = new TemplateExplanationService();

const report = (overrides = {}): Promise<ReportModel> =>
  buildReport(make(overrides), { explanationService: template });

/** Flattens every piece of text in the document so content can be asserted. */
function allText(document: ReportDocument): string {
  const fromBlock = (block: DocumentBlock): string => {
    switch (block.kind) {
      case 'paragraph':
        return block.text;
      case 'bullets':
        return block.items.join(' ');
      case 'fields':
        return block.fields.map((f) => `${f.label} ${f.value} ${f.note ?? ''}`).join(' ');
      case 'table':
        return [...block.columns, ...block.rows.flat()].join(' ');
      case 'callout':
        return `${block.title} ${block.text}`;
    }
  };

  return document.sections
    .map((section) => [section.title, section.lede ?? '', ...section.blocks.map(fromBlock)].join(' '))
    .join(' ');
}

describe('customer PDF document', () => {
  it('carries the identifying details a customer needs on their record', async () => {
    const built = await report();
    const document = buildReportDocument(built);

    expect(document.title).toBe('Just Wiser');
    expect(document.reference).toBe(built.assessment.id);
    expect(document.generatedAt).not.toBe('');
    expect(document.headline).toBe(built.decision.headline);
    expect(document.recommendation).toBe(built.decision.recommendation);
  });

  it('shows the same recommendation the engine produced, never its own', async () => {
    const built = await report();
    const document = buildReportDocument(built);
    const text = allText(document);

    expect(text).toContain(built.decision.headline);
    expect(text).toContain(built.decision.summary);
  });

  it('reports the calculated figures rather than recalculating them', async () => {
    const built = await report();
    const text = allText(buildReportDocument(built));

    // Each of these is read straight off the metrics object, so if the PDF
    // ever started computing its own numbers these would drift.
    expect(text).toContain(formatCurrency(built.metrics.ownershipCosts.total));
    expect(text).toContain(formatCurrency(built.metrics.mortgage.loanAmount));
    expect(text).toContain(formatCurrency(built.metrics.transactionCosts.total));
    expect(text).toContain(formatCurrency(built.metrics.resilience.savingsRemaining));
    expect(text).toContain(formatCurrency(built.metrics.baseOutcome.netEquityOnSale));
    expect(text).toContain(formatCurrency(built.metrics.baseOutcome.renterInvestedCapital));
    expect(text).toContain(formatCurrency(built.metrics.baseOutcome.netAdvantageOfBuying));
  });

  it('includes every section the customer needs to follow the reasoning', async () => {
    const document = buildReportDocument(await report());
    const titles = document.sections.map((section) => section.title.toLowerCase()).join(' | ');

    for (const expected of [
      'recommendation',
      'financial information',
      'financing',
      'circumstances',
      'affordability',
      'safety net',
      'compared with renting',
      'futures',
      'scored',
      'why the model',
      'assumptions',
      'does not do',
      'responsibly',
    ]) {
      expect(titles, `missing section: ${expected}`).toContain(expected);
    }
  });

  it('lists all three scenarios with their direction', async () => {
    const built = await report();
    const document = buildReportDocument(built);

    const table = document.sections
      .flatMap((section) => section.blocks)
      .find((block): block is Extract<DocumentBlock, { kind: 'table' }> => block.kind === 'table');

    expect(table).toBeDefined();
    expect(table?.rows).toHaveLength(3);
    expect(table?.rows.map((row) => row[0])).toEqual(['Conservative', 'Base', 'Optimistic']);
  });

  it('explains robustness rather than presenting one projection as fact', async () => {
    const built = await report();
    const text = allText(buildReportDocument(built));
    expect(text).toContain(
      `${built.decision.robustness.supporting} of ${built.decision.robustness.total}`,
    );
  });

  it('carries the reasons, risks and levers from the decision object', async () => {
    const built = await report();
    const text = allText(buildReportDocument(built));

    for (const reason of built.decision.reasons) expect(text).toContain(reason.statement);
    for (const risk of built.decision.risks) expect(text).toContain(risk.statement);
    for (const lever of built.decision.whatCouldChange) expect(text).toContain(lever.statement);
  });

  it('always states the limitations and the responsible-use disclaimer', async () => {
    const document = buildReportDocument(await report());
    const text = allText(document);

    expect(document.disclaimer).toContain('not financial advice');
    expect(text).toContain('cannot predict the future');
    expect(text).toContain('not a credit assessment');
  });

  it('discloses when the interest rate was assumed rather than given', async () => {
    const assumed = buildReportDocument(await report({ interestRate: null }));
    expect(allText(assumed)).toContain('you did not know your rate');

    const given = buildReportDocument(await report({ interestRate: 0.115 }));
    expect(allText(given)).not.toContain('you did not know your rate');
  });

  it('discloses when the holding period was assumed', async () => {
    const document = buildReportDocument(await report({ expectedStay: 'unsure' }));
    expect(allText(document)).toContain('We assumed 5 years');
  });

  it('contains no personally identifying information', async () => {
    const built = await report();
    const document = buildReportDocument(built);
    const text = allText(document).toLowerCase();

    // The reference is the only identifier, and it is random.
    expect(text).not.toContain('surname');
    expect(text).not.toContain('id number');
    expect(text).not.toContain('@');
    expect(document.reference).toBe(built.assessment.id);
  });

  it('uses no em dash anywhere in the customer document', async () => {
    const document = buildReportDocument(await report());
    const text = `${allText(document)} ${document.disclaimer} ${document.headline}`;
    expect(text).not.toContain('—');
  });
});

describe('customer PDF across every recommendation class', () => {
  /**
   * The three classes are reached through genuinely different customers rather
   * than by forcing the recommendation, so this also proves the document holds
   * up for a blocked purchase where several sections are absent.
   */
  const profiles: { name: string; overrides: Parameters<typeof make>[0] }[] = [
    {
      name: 'comfortable buyer',
      overrides: { expectedStay: 'over_10', accessibleSavings: 900_000, monthlyIncome: 90_000 },
    },
    {
      // A genuinely close comparison, which is the case that produces the
      // hedged answer rather than either confident one.
      name: 'borderline buyer',
      overrides: {
        expectedStay: '5_to_10',
        accessibleSavings: 700_000,
        upfrontContribution: 600_000,
        monthlyIncome: 80_000,
      },
    },
    {
      name: 'cannot afford it',
      overrides: { monthlyIncome: 22_000, accessibleSavings: 40_000, propertyPrice: 2_400_000 },
    },
  ];

  const seen = new Set<Recommendation>();

  for (const profile of profiles) {
    it(`builds a complete document for the ${profile.name}`, async () => {
      const built = await report(profile.overrides);
      const document = buildReportDocument(built);
      seen.add(built.decision.recommendation);

      expect(document.headline).toBe(built.decision.headline);
      expect(document.sections.length).toBeGreaterThan(8);
      // No section may be empty, or the PDF would render a stray heading.
      for (const section of document.sections) {
        expect(section.blocks.length, `empty section: ${section.title}`).toBeGreaterThan(0);
      }
      expect(allText(document)).not.toContain('undefined');
      expect(allText(document)).not.toContain('NaN');
    });
  }

  it('covers all three recommendation classes between the profiles', () => {
    expect(seen.size).toBe(3);
  });
});

describe('timestamp formatting', () => {
  it('renders an ISO timestamp for a South African reader', () => {
    expect(formatTimestamp('2026-03-09T14:05:00.000Z')).toMatch(
      /^\d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}$/,
    );
  });

  it('returns the original string when the date cannot be parsed', () => {
    expect(formatTimestamp('not a date')).toBe('not a date');
  });
});
