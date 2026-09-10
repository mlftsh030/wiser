import { describe, expect, it } from 'vitest';
import { calculateMortgage, monthlyPayment, remainingBalance } from '../mortgage';

describe('monthlyPayment', () => {
  it('matches the standard annuity result for a typical SA bond', () => {
    // R1,000,000 at 10.75% over 20 years.
    expect(monthlyPayment({ loanAmount: 1_000_000, annualRate: 0.1075, termYears: 20 })).toBeCloseTo(
      10_152.29,
      1,
    );
  });

  it('divides the principal evenly when the rate is zero', () => {
    // Guards the division-by-zero branch: without it this returns NaN.
    expect(monthlyPayment({ loanAmount: 240_000, annualRate: 0, termYears: 20 })).toBeCloseTo(1000, 6);
  });

  it('returns zero for a zero or negative loan', () => {
    expect(monthlyPayment({ loanAmount: 0, annualRate: 0.11, termYears: 20 })).toBe(0);
    expect(monthlyPayment({ loanAmount: -5000, annualRate: 0.11, termYears: 20 })).toBe(0);
  });

  it('returns zero for a zero-length term rather than dividing by zero', () => {
    expect(monthlyPayment({ loanAmount: 500_000, annualRate: 0.11, termYears: 0 })).toBe(0);
  });

  it('lowers the monthly payment as the term lengthens', () => {
    const rate = 0.11;
    const terms = [10, 15, 20, 25, 30];
    const payments = terms.map((termYears) =>
      monthlyPayment({ loanAmount: 1_000_000, annualRate: rate, termYears }),
    );
    for (let i = 1; i < payments.length; i++) {
      expect(payments[i]).toBeLessThan(payments[i - 1]);
    }
  });

  it('raises the monthly payment as the rate rises', () => {
    const rates = [0.07, 0.09, 0.11, 0.13];
    const payments = rates.map((annualRate) =>
      monthlyPayment({ loanAmount: 1_000_000, annualRate, termYears: 20 }),
    );
    for (let i = 1; i < payments.length; i++) {
      expect(payments[i]).toBeGreaterThan(payments[i - 1]);
    }
  });
});

describe('remainingBalance', () => {
  const loan = { loanAmount: 1_000_000, annualRate: 0.1075, termYears: 20 };

  it('is the full principal before any payment is made', () => {
    expect(remainingBalance(loan, 0)).toBeCloseTo(1_000_000, 2);
  });

  it('is fully repaid at the end of the term', () => {
    // Regression guard: the closed-form balance must land exactly on zero,
    // otherwise projected equity is silently wrong.
    expect(remainingBalance(loan, 240)).toBeCloseTo(0, 4);
  });

  it('never goes negative when asked beyond the term', () => {
    expect(remainingBalance(loan, 600)).toBe(0);
  });

  it('amortises slowly at first, which is why short stays build little equity', () => {
    // After a quarter of the term, far less than a quarter of the loan is repaid.
    const afterFiveYears = remainingBalance(loan, 60);
    expect(afterFiveYears).toBeGreaterThan(880_000);
    expect(afterFiveYears).toBeLessThan(1_000_000);
  });

  it('amortises linearly when the rate is zero', () => {
    expect(remainingBalance({ loanAmount: 240_000, annualRate: 0, termYears: 20 }, 120)).toBeCloseTo(
      120_000,
      6,
    );
  });
});

describe('calculateMortgage', () => {
  it('reports total interest as the excess of repayments over principal', () => {
    const result = calculateMortgage(
      { loanAmount: 1_000_000, annualRate: 0.1075, termYears: 20 },
      false,
    );
    expect(result.totalRepaid).toBeCloseTo(result.monthlyPayment * 240, 2);
    expect(result.totalInterest).toBeCloseTo(result.totalRepaid - 1_000_000, 2);
    expect(result.totalInterest).toBeGreaterThan(1_000_000);
  });

  it('carries the default-rate flag through for the UI to label', () => {
    expect(
      calculateMortgage({ loanAmount: 500_000, annualRate: 0.1075, termYears: 20 }, true)
        .usedDefaultRate,
    ).toBe(true);
  });

  it('reports no interest on an interest-free loan', () => {
    const result = calculateMortgage({ loanAmount: 240_000, annualRate: 0, termYears: 20 }, false);
    expect(result.totalInterest).toBeCloseTo(0, 6);
  });
});
