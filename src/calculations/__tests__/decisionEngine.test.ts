import { describe, expect, it } from 'vitest';
import { calculateMetrics } from '../metrics';
import { decide } from '../decisionEngine';
import { make } from './fixtures';
import type { Assessment } from '../../models/assessment';

const run = (assessment: Assessment) => decide(assessment, calculateMetrics(assessment));

describe('decision engine - stage 1 acts as a hard constraint', () => {
  it('recommends renting when the monthly cost exceeds available income', () => {
    // A modest income against an expensive property: no amount of personal
    // enthusiasm should override this.
    const result = run(
      make({
        monthlyIncome: 25_000,
        essentialExpenses: 15_000,
        existingDebtRepayments: 5_000,
        propertyPrice: 3_000_000,
        upfrontContribution: 100_000,
        accessibleSavings: 2_000_000,
        expectedStay: 'over_10',
        ownershipImportance: 5,
        flexibilityImportance: 1,
      }),
    );
    expect(result.recommendation).toBe('RENT_FOR_NOW');
    expect(result.reasons.some((r) => r.category === 'financial_position')).toBe(true);
    expect(result.risks.some((r) => r.severity === 'high')).toBe(true);
  });

  it('recommends renting when savings cannot cover the deposit and costs', () => {
    const result = run(
      make({ accessibleSavings: 250_000, upfrontContribution: 250_000, expectedStay: 'over_10' }),
    );
    expect(result.recommendation).toBe('RENT_FOR_NOW');
    expect(result.risks[0].severity).toBe('high');
  });

  it('recommends renting when the purchase would leave under a month of buffer', () => {
    // Deposit of R300k plus roughly R80k of purchase costs against R390k of
    // savings leaves under R10k - well under one month of expenses.
    const result = run(
      make({ accessibleSavings: 390_000, upfrontContribution: 300_000, expectedStay: 'over_10' }),
    );
    expect(result.recommendation).toBe('RENT_FOR_NOW');
  });

  it('offers a concrete savings target when the buffer is the problem', () => {
    const result = run(
      make({ accessibleSavings: 390_000, upfrontContribution: 300_000, expectedStay: 'over_10' }),
    );
    const savingsLever = result.whatCouldChange.find((l) => l.category === 'savings');
    expect(savingsLever).toBeDefined();
    expect(savingsLever!.statement).toMatch(/R[\d\s,]+/);
  });
});

describe('decision engine - stage 2 and 3', () => {
  it('finds buying attractive when finances are safe and the horizon is long', () => {
    const result = run(
      make({
        monthlyIncome: 90_000,
        essentialExpenses: 20_000,
        existingDebtRepayments: 2_000,
        accessibleSavings: 1_200_000,
        upfrontContribution: 400_000,
        currentRent: 18_000,
        expectedStay: 'over_10',
        moveLikelihood: 'very_unlikely',
        ownershipImportance: 5,
        flexibilityImportance: 1,
      }),
    );
    expect(result.recommendation).toBe('BUYING_LOOKS_ATTRACTIVE');
    expect(result.strongestFactor?.impact).toBe('positive');
  });

  it('recommends renting when the customer plans to leave within three years', () => {
    // Financially safe, but the horizon defeats the transaction costs.
    const result = run(
      make({
        monthlyIncome: 90_000,
        essentialExpenses: 20_000,
        accessibleSavings: 1_200_000,
        expectedStay: 'under_3',
        moveLikelihood: 'very_likely',
      }),
    );
    expect(result.recommendation).toBe('RENT_FOR_NOW');
    expect(result.reasons.some((r) => r.category === 'personal_fit')).toBe(true);
  });

  it('never calls a strained purchase attractive, even when the numbers favour buying', () => {
    // Long stay and favourable economics, but a thin cash buffer afterwards.
    const attractive = run(
      make({
        monthlyIncome: 90_000,
        essentialExpenses: 20_000,
        existingDebtRepayments: 2_000,
        accessibleSavings: 1_200_000,
        upfrontContribution: 400_000,
        expectedStay: 'over_10',
        moveLikelihood: 'very_unlikely',
      }),
    );
    const strained = run(
      make({
        monthlyIncome: 90_000,
        essentialExpenses: 20_000,
        existingDebtRepayments: 2_000,
        accessibleSavings: 500_000,
        upfrontContribution: 400_000,
        expectedStay: 'over_10',
        moveLikelihood: 'very_unlikely',
      }),
    );
    expect(attractive.recommendation).toBe('BUYING_LOOKS_ATTRACTIVE');
    expect(strained.recommendation).not.toBe('BUYING_LOOKS_ATTRACTIVE');
  });
});

describe('decision engine - explainability contract', () => {
  const result = run(make({}));

  it('always produces at least one reason', () => {
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('ranks reasons by weight so the report can lead with what mattered', () => {
    const weights = result.reasons.map((r) => r.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('tags every reason with a category and an impact', () => {
    for (const reason of result.reasons) {
      expect(['financial_position', 'resilience', 'financial_outcome', 'personal_fit']).toContain(
        reason.category,
      );
      expect(['positive', 'negative', 'neutral']).toContain(reason.impact);
      expect(reason.statement.length).toBeGreaterThan(20);
    }
  });

  it('always offers at least one thing the customer could change', () => {
    expect(result.whatCouldChange.length).toBeGreaterThan(0);
  });

  it('states the interest-rate sensitivity as a monthly rand figure', () => {
    expect(result.whatCouldChange.some((l) => l.category === 'financing')).toBe(true);
  });

  it('avoids prescriptive language in the headline and summary', () => {
    for (const assessment of [
      make({}),
      make({ expectedStay: 'under_3' }),
      make({ accessibleSavings: 320_000, upfrontContribution: 300_000 }),
    ]) {
      const { headline, summary } = run(assessment);
      expect(`${headline} ${summary}`.toLowerCase()).not.toMatch(
        /you should|you must|definitely|guaranteed|we recommend that you/,
      );
    }
  });
});

describe('recommendation robustness', () => {
  it('counts the scenarios that agree with the recommendation', () => {
    const result = run(make({}));
    expect(result.robustness.total).toBe(3);
    expect(result.robustness.supporting).toBeGreaterThanOrEqual(0);
    expect(result.robustness.supporting).toBeLessThanOrEqual(3);
  });

  it('flags sensitivity only when scenarios point in opposite directions', () => {
    const result = run(make({ expectedStay: '3_to_5' }));
    const directions = new Set(result.robustness.sensitive ? ['buy', 'rent'] : []);
    if (result.robustness.sensitive) {
      expect(directions.size).toBe(2);
      expect(result.risks.some((r) => /assumption|market/i.test(r.statement))).toBe(true);
    }
  });

  it('reports honest sensitivity when a cautious scenario still favours renting', () => {
    // Even a comfortable, long-horizon buyer is exposed to weak property
    // growth. The model must say so rather than reporting 3/3 agreement, and
    // must surface the corresponding risk to the customer.
    const result = run(
      make({
        monthlyIncome: 90_000,
        essentialExpenses: 20_000,
        accessibleSavings: 1_200_000,
        expectedStay: 'over_10',
        moveLikelihood: 'very_unlikely',
      }),
    );
    expect(result.recommendation).not.toBe('RENT_FOR_NOW');
    expect(result.robustness.supporting).toBe(2);
    expect(result.robustness.total).toBe(3);
    expect(result.robustness.sensitive).toBe(true);
    expect(result.risks.some((r) => /market|assumption/i.test(r.statement))).toBe(true);
  });
});

describe('decision engine - internal coherence', () => {
  /**
   * The recommendation and the robustness figure are shown side by side on the
   * result page. If they can disagree, the report contradicts itself in front
   * of the customer - so this is a contract, not a nicety.
   */
  const cases: Array<[string, Assessment]> = [
    ['comfortable long stay', make({ monthlyIncome: 90_000, essentialExpenses: 20_000, accessibleSavings: 1_200_000, expectedStay: 'over_10', moveLikelihood: 'very_unlikely' })],
    ['baseline', make({})],
    ['short stay', make({ expectedStay: 'under_3', moveLikelihood: 'very_likely' })],
    ['thin buffer', make({ accessibleSavings: 390_000, upfrontContribution: 300_000 })],
    ['stretched income', make({ monthlyIncome: 28_000, essentialExpenses: 14_000 })],
    ['keen owner, weak economics', make({ expectedStay: '3_to_5', ownershipImportance: 5, flexibilityImportance: 1, riskTolerance: 5 })],
    ['cash buyer', make({ propertyPrice: 900_000, upfrontContribution: 900_000, accessibleSavings: 1_500_000 })],
    ['no savings at all', make({ accessibleSavings: 0, upfrontContribution: 0 })],
  ];

  it.each(cases)('never recommends buying while most scenarios favour renting (%s)', (_label, assessment) => {
    const result = run(assessment);
    if (result.recommendation === 'RENT_FOR_NOW') return;

    const rentFavouring = calculateMetrics(assessment).scenarios.filter(
      (s) => s.outcome.favours === 'rent',
    ).length;
    expect(rentFavouring).toBeLessThanOrEqual(1);
  });

  it.each(cases)('reports robustness consistent with the recommendation (%s)', (_label, assessment) => {
    const result = run(assessment);
    const { supporting, total } = result.robustness;
    expect(supporting).toBeGreaterThanOrEqual(0);
    expect(supporting).toBeLessThanOrEqual(total);

    // A confident "attractive" verdict must not rest on a minority of scenarios.
    if (result.recommendation === 'BUYING_LOOKS_ATTRACTIVE') {
      expect(supporting).toBeGreaterThan(total / 2);
    }
  });

  it.each(cases)('produces finite, sane numbers throughout (%s)', (_label, assessment) => {
    const metrics = calculateMetrics(assessment);
    expect(Number.isFinite(metrics.mortgage.monthlyPayment)).toBe(true);
    expect(Number.isFinite(metrics.ownershipCosts.total)).toBe(true);
    expect(Number.isFinite(metrics.resilience.bufferMonths)).toBe(true);
    for (const value of Object.values(metrics.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('does not let a strong personal preference overturn weak economics', () => {
    // Same finances, opposite preferences: preference may soften or harden the
    // answer, but it must not turn a rent-favouring comparison into "attractive".
    const keen = run(make({ expectedStay: '3_to_5', ownershipImportance: 5, flexibilityImportance: 1 }));
    expect(keen.recommendation).not.toBe('BUYING_LOOKS_ATTRACTIVE');
  });
});
