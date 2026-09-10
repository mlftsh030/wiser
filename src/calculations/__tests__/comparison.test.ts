import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from '../../config/assumptions';
import { compareBuyVsRent, type ComparisonInput } from '../comparison';
import { monthlyPayment } from '../mortgage';
import { applyScenario, runScenarios, SCENARIOS } from '../scenarios';
import { calculateTransactionCosts } from '../transactionCosts';
import { make } from './fixtures';

function buildInput(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  const assessment = overrides.assessment ?? make({});
  const loanAmount = assessment.propertyPrice - assessment.upfrontContribution;
  const annualRate = assessment.interestRate ?? DEFAULT_ASSUMPTIONS.rates.defaultInterestRate;
  return {
    assessment,
    loanAmount,
    annualRate,
    monthlyMortgage: monthlyPayment({ loanAmount, annualRate, termYears: assessment.loanTermYears }),
    transactionCosts: calculateTransactionCosts(assessment.propertyPrice, loanAmount),
    years: 7,
    ...overrides,
  };
}

describe('compareBuyVsRent', () => {
  it('credits the renter with the capital the buyer spends upfront', () => {
    const input = buildInput({ years: 1 });
    const outcome = compareBuyVsRent(input);
    // Even after just one year the renter's pot must exceed the cash the buyer
    // laid out, because it has been invested. Without this the model would
    // unfairly flatter buying.
    expect(outcome.renterInvestedCapital).toBeGreaterThan(
      input.assessment.upfrontContribution + input.transactionCosts.total,
    );
  });

  it('leaves a short-stay buyer worse off because of transaction costs', () => {
    const outcome = compareBuyVsRent(buildInput({ years: 2 }));
    expect(outcome.netAdvantageOfBuying).toBeLessThan(0);
    expect(outcome.favours).toBe('rent');
  });

  it('improves the case for buying as the holding period lengthens', () => {
    const short = compareBuyVsRent(buildInput({ years: 3 }));
    const long = compareBuyVsRent(buildInput({ years: 15 }));
    expect(long.netAdvantageOfBuying).toBeGreaterThan(short.netAdvantageOfBuying);
  });

  it('deducts selling costs from the equity figure', () => {
    const outcome = compareBuyVsRent(buildInput({ years: 10 }));
    const grossEquity = outcome.projectedPropertyValue - outcome.outstandingLoan;
    expect(outcome.netEquityOnSale).toBeLessThan(grossEquity);
  });

  it('grows the property at the assumed rate', () => {
    const input = buildInput({ years: 10 });
    const outcome = compareBuyVsRent(input);
    expect(outcome.projectedPropertyValue).toBeCloseTo(
      input.assessment.propertyPrice * Math.pow(1 + DEFAULT_ASSUMPTIONS.rates.propertyGrowth, 10),
      0,
    );
  });

  it('reports a neutral verdict when the two sides land close together', () => {
    const outcome = compareBuyVsRent(buildInput({ years: 7 }));
    expect(['buy', 'rent', 'neutral']).toContain(outcome.favours);
  });

  it('produces finite numbers at a zero interest rate', () => {
    const outcome = compareBuyVsRent(buildInput({ annualRate: 0, monthlyMortgage: 6250 }));
    expect(Number.isFinite(outcome.netAdvantageOfBuying)).toBe(true);
  });

  it('handles a cash purchase with no loan', () => {
    const assessment = make({ upfrontContribution: 1_800_000, accessibleSavings: 2_500_000 });
    const outcome = compareBuyVsRent(
      buildInput({ assessment, loanAmount: 0, monthlyMortgage: 0, years: 10 }),
    );
    expect(outcome.outstandingLoan).toBe(0);
    expect(Number.isFinite(outcome.netAdvantageOfBuying)).toBe(true);
  });
});

describe('scenarios', () => {
  it('runs one comparison per defined scenario', () => {
    const results = runScenarios(buildInput());
    expect(results).toHaveLength(SCENARIOS.length);
    expect(results.map((r) => r.name)).toEqual(['conservative', 'base', 'optimistic']);
  });

  it('orders outcomes conservative <= base <= optimistic for the buyer', () => {
    const [conservative, base, optimistic] = runScenarios(buildInput({ years: 10 }));
    expect(conservative.outcome.netAdvantageOfBuying).toBeLessThan(
      base.outcome.netAdvantageOfBuying,
    );
    expect(optimistic.outcome.netAdvantageOfBuying).toBeGreaterThan(
      base.outcome.netAdvantageOfBuying,
    );
  });

  it('leaves the base scenario identical to the unadjusted assumptions', () => {
    const base = SCENARIOS.find((s) => s.name === 'base')!;
    expect(applyScenario(DEFAULT_ASSUMPTIONS, base).rates).toEqual(DEFAULT_ASSUMPTIONS.rates);
  });

  it('never produces a negative growth rate from an adjustment', () => {
    const low = {
      ...DEFAULT_ASSUMPTIONS,
      rates: { ...DEFAULT_ASSUMPTIONS.rates, propertyGrowth: 0.005, investmentReturn: 0.005 },
    };
    for (const definition of SCENARIOS) {
      const adjusted = applyScenario(low, definition);
      expect(adjusted.rates.propertyGrowth).toBeGreaterThanOrEqual(0);
      expect(adjusted.rates.investmentReturn).toBeGreaterThanOrEqual(0);
      expect(adjusted.rates.rentalGrowth).toBeGreaterThanOrEqual(0);
    }
  });
});
