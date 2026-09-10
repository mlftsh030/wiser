/**
 * Mortgage (bond) mathematics.
 *
 * South African bonds are standard amortising loans with monthly compounding,
 * so the ordinary annuity formula applies:
 *
 *   M = L * i(1+i)^n / ((1+i)^n - 1)
 *
 * where i = r/12 and n = 12T. This is the same calculation as Excel's PMT.
 */

import type { MortgageBreakdown } from '../models/results';

export interface MortgageInput {
  loanAmount: number;
  annualRate: number;
  termYears: number;
}

/**
 * Monthly repayment on an amortising loan.
 *
 * The zero-rate branch is not a curiosity: the general formula divides by
 * ((1+i)^n - 1), which is 0 when i is 0, so an interest-free loan would
 * produce NaN and silently poison every downstream number.
 */
export function monthlyPayment({ loanAmount, annualRate, termYears }: MortgageInput): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;

  const n = termYears * 12;
  const i = annualRate / 12;

  if (i === 0) return loanAmount / n;

  const growth = Math.pow(1 + i, n);
  return (loanAmount * i * growth) / (growth - 1);
}

/**
 * Loan balance still outstanding after a given number of months.
 *
 * Used to work out equity at the end of the holding period. Derived in closed
 * form rather than by iterating an amortisation table, so that projections over
 * long horizons stay cheap enough to run on every keystroke.
 */
export function remainingBalance(
  { loanAmount, annualRate, termYears }: MortgageInput,
  monthsElapsed: number,
): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;

  const n = termYears * 12;
  const months = Math.min(Math.max(monthsElapsed, 0), n);
  const i = annualRate / 12;

  if (i === 0) return loanAmount * (1 - months / n);

  const growth = Math.pow(1 + i, months);
  const payment = monthlyPayment({ loanAmount, annualRate, termYears });

  // Balance = original balance grown by interest, less the future value of
  // payments already made.
  const balance = loanAmount * growth - payment * ((growth - 1) / i);
  return Math.max(balance, 0);
}

/** Full breakdown, including the total interest cost over the life of the loan. */
export function calculateMortgage(
  input: MortgageInput,
  usedDefaultRate: boolean,
): MortgageBreakdown {
  const payment = monthlyPayment(input);
  const totalRepaid = payment * input.termYears * 12;

  return {
    loanAmount: input.loanAmount,
    monthlyPayment: payment,
    totalRepaid,
    totalInterest: Math.max(totalRepaid - input.loanAmount, 0),
    usedDefaultRate,
    annualRate: input.annualRate,
  };
}
