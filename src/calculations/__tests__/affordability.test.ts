import { describe, expect, it } from 'vitest';
import { calculateFinancialPosition, calculateResilience } from '../affordability';
import { calculateTransactionCosts } from '../transactionCosts';
import { make } from './fixtures';

describe('calculateFinancialPosition', () => {
  it('computes surplus before housing as I - E - D', () => {
    const position = calculateFinancialPosition(
      make({ monthlyIncome: 60_000, essentialExpenses: 18_000, existingDebtRepayments: 4_000 }),
      20_000,
    );
    expect(position.monthlySurplusBeforeHousing).toBe(38_000);
    expect(position.monthlySurplusAfterHousing).toBe(18_000);
  });

  it('flags a comfortable case as affordable', () => {
    const position = calculateFinancialPosition(make({}), 18_000);
    expect(position.isUnaffordable).toBe(false);
    expect(position.monthlySurplusAfterHousing).toBeGreaterThan(0);
  });

  it('flags the borderline case where housing exactly consumes the surplus', () => {
    const position = calculateFinancialPosition(make({}), 38_000);
    expect(position.monthlySurplusAfterHousing).toBe(0);
    // Exactly zero is not negative, so not yet "unaffordable" - but the
    // decision engine treats a margin this thin as strained.
    expect(position.isUnaffordable).toBe(false);
  });

  it('flags an unaffordable case when housing exceeds available income', () => {
    const position = calculateFinancialPosition(make({}), 45_000);
    expect(position.isUnaffordable).toBe(true);
    expect(position.monthlySurplusAfterHousing).toBeLessThan(0);
  });

  it('computes the renting surplus using current rent', () => {
    const position = calculateFinancialPosition(make({ currentRent: 12_000 }), 25_000);
    expect(position.monthlySurplusIfRenting).toBe(26_000);
  });

  it('does not divide by zero when income is zero', () => {
    const position = calculateFinancialPosition(make({ monthlyIncome: 0 }), 10_000);
    expect(Number.isFinite(position.housingCostRatio)).toBe(true);
  });
});

describe('calculateResilience', () => {
  const costs = (price: number, loan: number) => calculateTransactionCosts(price, loan);

  it('classifies healthy remaining savings as strong', () => {
    const assessment = make({ accessibleSavings: 900_000, upfrontContribution: 300_000 });
    const r = calculateResilience(assessment, costs(1_800_000, 1_500_000));
    expect(r.canCoverUpfront).toBe(true);
    expect(r.band).toBe('strong');
    expect(r.bufferMonths).toBeGreaterThan(6);
  });

  it('detects a shortfall when savings cannot cover deposit plus costs', () => {
    const assessment = make({ accessibleSavings: 310_000, upfrontContribution: 300_000 });
    const r = calculateResilience(assessment, costs(1_800_000, 1_500_000));
    expect(r.canCoverUpfront).toBe(false);
    expect(r.shortfall).toBeGreaterThan(0);
    expect(r.band).toBe('very_limited');
  });

  it('detects the almost-nothing-left case', () => {
    // Savings just cover the deposit and costs, leaving a sliver behind.
    const c = costs(1_800_000, 1_500_000);
    const assessment = make({
      accessibleSavings: 300_000 + c.total + 5_000,
      upfrontContribution: 300_000,
    });
    const r = calculateResilience(assessment, c);
    expect(r.canCoverUpfront).toBe(true);
    expect(r.savingsRemaining).toBeCloseTo(5_000, 0);
    expect(r.bufferMonths).toBeLessThan(1);
    expect(r.band).toBe('very_limited');
  });

  it('measures the buffer against essentials plus debt, not total income', () => {
    const c = costs(1_800_000, 1_500_000);
    const assessment = make({
      accessibleSavings: 300_000 + c.total + 66_000,
      upfrontContribution: 300_000,
      essentialExpenses: 18_000,
      existingDebtRepayments: 4_000,
    });
    const r = calculateResilience(assessment, c);
    // 66_000 / (18_000 + 4_000) = 3 months
    expect(r.bufferMonths).toBeCloseTo(3, 1);
    expect(r.band).toBe('moderate');
  });

  it('does not return Infinity when there are no fixed commitments', () => {
    const assessment = make({
      essentialExpenses: 0,
      existingDebtRepayments: 0,
      accessibleSavings: 900_000,
      upfrontContribution: 300_000,
    });
    const r = calculateResilience(assessment, costs(1_800_000, 1_500_000));
    expect(Number.isFinite(r.bufferMonths)).toBe(true);
  });
});
