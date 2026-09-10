/**
 * Input validation.
 *
 * Financial nonsense in produces financial nonsense out, and a decision-support
 * tool that silently accepts an impossible input is worse than one that
 * refuses. Rules live here rather than in the form components so they can be
 * unit tested and reused by any future interface.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import { formatCurrency, formatPercent } from './format';

export type ValidationErrors = Record<string, string>;

export interface DraftAssessment {
  monthlyIncome?: number | null;
  essentialExpenses?: number | null;
  existingDebtRepayments?: number | null;
  accessibleSavings?: number | null;
  currentRent?: number | null;
  propertyPrice?: number | null;
  upfrontContribution?: number | null;
  interestRate?: number | null;
  rateUnknown?: boolean;
  loanTermYears?: number | null;
}

const required = (value: number | null | undefined): boolean =>
  value === null || value === undefined || Number.isNaN(value);

/** Validates one page's worth of fields, returning only that page's errors. */
export function validateSituation(draft: DraftAssessment): ValidationErrors {
  const errors: ValidationErrors = {};

  if (required(draft.monthlyIncome)) {
    errors.monthlyIncome = 'Please tell us your monthly take-home income.';
  } else if (draft.monthlyIncome! < 0) {
    errors.monthlyIncome = 'Income cannot be negative.';
  } else if (draft.monthlyIncome! === 0) {
    errors.monthlyIncome = 'We need an income figure above zero to work out what you could afford.';
  }

  if (required(draft.essentialExpenses)) {
    errors.essentialExpenses = 'Please tell us roughly what your essential expenses come to.';
  } else if (draft.essentialExpenses! < 0) {
    errors.essentialExpenses = 'Expenses cannot be negative.';
  }

  if (required(draft.existingDebtRepayments)) {
    errors.existingDebtRepayments = 'Please enter your debt repayments, or 0 if you have none.';
  } else if (draft.existingDebtRepayments! < 0) {
    errors.existingDebtRepayments = 'Debt repayments cannot be negative.';
  }

  if (required(draft.accessibleSavings)) {
    errors.accessibleSavings = 'Please enter your accessible savings, or 0 if you have none.';
  } else if (draft.accessibleSavings! < 0) {
    errors.accessibleSavings = 'Savings cannot be negative.';
  }

  // Not an error - people do run at a deficit - but they should see it.
  if (
    !errors.monthlyIncome &&
    !errors.essentialExpenses &&
    !errors.existingDebtRepayments &&
    (draft.monthlyIncome ?? 0) -
      (draft.essentialExpenses ?? 0) -
      (draft.existingDebtRepayments ?? 0) <
      0
  ) {
    errors._warning =
      'Your essential expenses and debt repayments currently add up to more than your take-home income. We will still run the analysis, but this is worth looking at first.';
  }

  return errors;
}

export function validateHome(draft: DraftAssessment): ValidationErrors {
  const errors: ValidationErrors = {};

  if (required(draft.currentRent)) {
    errors.currentRent = 'Please enter your current rent, or 0 if you do not pay rent.';
  } else if (draft.currentRent! < 0) {
    errors.currentRent = 'Rent cannot be negative.';
  }

  if (required(draft.propertyPrice)) {
    errors.propertyPrice = 'Please enter the price of the property you have in mind.';
  } else if (draft.propertyPrice! <= 0) {
    errors.propertyPrice = 'The property price must be more than zero.';
  }

  if (required(draft.upfrontContribution)) {
    errors.upfrontContribution = 'Please enter how much you would put towards the purchase, or 0.';
  } else if (draft.upfrontContribution! < 0) {
    errors.upfrontContribution = 'This cannot be negative.';
  } else if (
    draft.accessibleSavings !== null &&
    draft.accessibleSavings !== undefined &&
    draft.upfrontContribution! > draft.accessibleSavings
  ) {
    errors.upfrontContribution = `This is more than the ${formatCurrency(
      draft.accessibleSavings,
    )} in accessible savings you told us about. Please lower it, or go back and update your savings if you have another source of funds.`;
  } else if (
    draft.propertyPrice !== null &&
    draft.propertyPrice !== undefined &&
    draft.propertyPrice > 0 &&
    draft.upfrontContribution! > draft.propertyPrice
  ) {
    errors.upfrontContribution = 'This is more than the property price.';
  }

  return errors;
}

export function validateFinancing(
  draft: DraftAssessment,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const { minInterestRate, maxInterestRate } = assumptions.rates;

  if (!draft.rateUnknown) {
    if (required(draft.interestRate)) {
      errors.interestRate =
        'Please enter an interest rate, or tell us you are not sure and we will use an assumption.';
    } else if (
      draft.interestRate! < minInterestRate ||
      draft.interestRate! > maxInterestRate
    ) {
      errors.interestRate = `Please enter a rate between ${formatPercent(
        minInterestRate,
        0,
      )} and ${formatPercent(maxInterestRate, 0)}.`;
    }
  }

  if (required(draft.loanTermYears)) {
    errors.loanTermYears = 'Please choose a loan term.';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  // The advisory warning key must not block progress.
  return Object.keys(errors).some((key) => key !== '_warning');
}
