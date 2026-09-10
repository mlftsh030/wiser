/**
 * Whether the household can carry the purchase month to month.
 *
 *   S_m = I - E - D          (surplus before housing)
 *   S_h = I - E - D - H      (surplus after housing)
 *
 * A negative S_h means the purchase cannot be sustained from income. That is
 * treated as a hard constraint by the decision engine, not as a low score.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import type { Assessment } from '../models/assessment';
import type { FinancialPosition, Resilience, TransactionCosts } from '../models/results';

export function calculateFinancialPosition(
  assessment: Assessment,
  monthlyOwnershipCost: number,
): FinancialPosition {
  const { monthlyIncome, essentialExpenses, existingDebtRepayments, currentRent } = assessment;

  const monthlySurplusBeforeHousing =
    monthlyIncome - essentialExpenses - existingDebtRepayments;
  const monthlySurplusAfterHousing = monthlySurplusBeforeHousing - monthlyOwnershipCost;
  const monthlySurplusIfRenting = monthlySurplusBeforeHousing - currentRent;

  // Guard against division by zero for a zero-income entry; ratios are only
  // meaningful with income, and 0 income is caught by validation anyway.
  const safeIncome = monthlyIncome > 0 ? monthlyIncome : 1;

  return {
    monthlySurplusBeforeHousing,
    monthlySurplusAfterHousing,
    monthlySurplusIfRenting,
    housingCostRatio: monthlyOwnershipCost / safeIncome,
    totalDebtRatio: (monthlyOwnershipCost + existingDebtRepayments) / safeIncome,
    isUnaffordable: monthlySurplusAfterHousing < 0,
  };
}

/**
 * What is left in the bank after buying, and how long it would last.
 *
 *   S_R = S - DP - C
 *   B   = S_R / (E + D)
 *
 * We deliberately measure the buffer against essential expenses plus debt
 * rather than against total income: in a crisis the question is how long the
 * household can meet its unavoidable commitments.
 */
export function calculateResilience(
  assessment: Assessment,
  transactionCosts: TransactionCosts,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): Resilience {
  const { accessibleSavings, upfrontContribution, essentialExpenses, existingDebtRepayments } =
    assessment;

  const cashNeeded = upfrontContribution + transactionCosts.total;
  const savingsRemaining = accessibleSavings - cashNeeded;
  const commitments = essentialExpenses + existingDebtRepayments;

  // With no fixed commitments any positive balance lasts indefinitely; we cap
  // the reported figure so the UI shows a sane number rather than Infinity.
  const bufferMonths =
    commitments > 0 ? savingsRemaining / commitments : savingsRemaining > 0 ? 99 : 0;

  return {
    savingsRemaining,
    bufferMonths,
    band: classifyBuffer(bufferMonths, assumptions),
    shortfall: Math.max(cashNeeded - accessibleSavings, 0),
    canCoverUpfront: savingsRemaining >= 0,
  };
}

function classifyBuffer(
  bufferMonths: number,
  assumptions: Assumptions,
): Resilience['band'] {
  const t = assumptions.resilience;
  if (bufferMonths >= t.strong) return 'strong';
  if (bufferMonths >= t.moderate) return 'moderate';
  if (bufferMonths >= t.limited) return 'limited';
  return 'very_limited';
}
