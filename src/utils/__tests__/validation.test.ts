import { describe, expect, it } from 'vitest';
import {
  hasErrors,
  validateFinancing,
  validateHome,
  validateSituation,
} from '../validation';

describe('validateSituation', () => {
  const valid = {
    monthlyIncome: 50_000,
    essentialExpenses: 15_000,
    existingDebtRepayments: 3_000,
    accessibleSavings: 200_000,
  };

  it('accepts a complete, sensible answer', () => {
    expect(hasErrors(validateSituation(valid))).toBe(false);
  });

  it('rejects negative figures', () => {
    expect(validateSituation({ ...valid, essentialExpenses: -1 }).essentialExpenses).toMatch(/negative/i);
    expect(validateSituation({ ...valid, accessibleSavings: -1 }).accessibleSavings).toMatch(/negative/i);
    expect(validateSituation({ ...valid, existingDebtRepayments: -1 }).existingDebtRepayments).toMatch(/negative/i);
  });

  it('rejects a zero income, which would make every ratio meaningless', () => {
    expect(validateSituation({ ...valid, monthlyIncome: 0 }).monthlyIncome).toBeTruthy();
  });

  it('accepts zero debt and zero savings as real answers', () => {
    expect(
      hasErrors(validateSituation({ ...valid, existingDebtRepayments: 0, accessibleSavings: 0 })),
    ).toBe(false);
  });

  it('requires every field', () => {
    const errors = validateSituation({});
    expect(Object.keys(errors)).toHaveLength(4);
  });

  it('warns about a deficit without blocking the journey', () => {
    const errors = validateSituation({ ...valid, essentialExpenses: 60_000 });
    expect(errors._warning).toBeTruthy();
    // A warning must not stop the customer from continuing.
    expect(hasErrors(errors)).toBe(false);
  });
});

describe('validateHome', () => {
  const valid = {
    currentRent: 10_000,
    propertyPrice: 1_500_000,
    upfrontContribution: 200_000,
    accessibleSavings: 300_000,
  };

  it('accepts a sensible answer', () => {
    expect(hasErrors(validateHome(valid))).toBe(false);
  });

  it('requires a property price above zero', () => {
    expect(validateHome({ ...valid, propertyPrice: 0 }).propertyPrice).toMatch(/more than zero/i);
  });

  it('rejects a deposit larger than accessible savings', () => {
    const error = validateHome({ ...valid, upfrontContribution: 400_000 }).upfrontContribution;
    expect(error).toMatch(/more than/i);
  });

  it('rejects a deposit larger than the property price', () => {
    expect(
      validateHome({ ...valid, upfrontContribution: 2_000_000, accessibleSavings: 3_000_000 })
        .upfrontContribution,
    ).toMatch(/more than the property price/i);
  });

  it('allows a deposit exactly equal to savings', () => {
    expect(hasErrors(validateHome({ ...valid, upfrontContribution: 300_000 }))).toBe(false);
  });

  it('accepts zero rent for someone not currently renting', () => {
    expect(hasErrors(validateHome({ ...valid, currentRent: 0 }))).toBe(false);
  });
});

describe('validateFinancing', () => {
  it('accepts a rate inside the configured range', () => {
    expect(hasErrors(validateFinancing({ interestRate: 0.1075, loanTermYears: 20 }))).toBe(false);
  });

  it('rejects an implausible rate', () => {
    expect(validateFinancing({ interestRate: 0.9, loanTermYears: 20 }).interestRate).toBeTruthy();
    expect(validateFinancing({ interestRate: 0.001, loanTermYears: 20 }).interestRate).toBeTruthy();
  });

  it('skips the rate check when the customer says they do not know', () => {
    expect(
      hasErrors(validateFinancing({ rateUnknown: true, interestRate: null, loanTermYears: 20 })),
    ).toBe(false);
  });

  it('requires a rate when the customer has not opted out', () => {
    expect(validateFinancing({ interestRate: null, loanTermYears: 20 }).interestRate).toBeTruthy();
  });
});
