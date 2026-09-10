/**
 * "What could change the result?"
 *
 * Separated from the decision engine because this answers a different question.
 * The engine decides where the customer stands; this works out what they could
 * do about it - which is the part that gives them agency rather than a verdict.
 *
 * Every figure here is calculated from the model. We never invent a target.
 */

import type { Assumptions } from '../config/assumptions';
import type { Assessment } from '../models/assessment';
import type { CalculatedMetrics, Lever } from '../models/results';
import { formatCurrency } from '../utils/format';

/** Whether Stage 1 found the purchase possible but uncomfortable. */
export interface SafetyFlags {
  isUnaffordable: boolean;
  strained: boolean;
}

/**
 * Concrete, calculated changes that would move the result.
 *
 * Every figure here comes from the model - we never invent a target. This is
 * the part that gives the customer agency rather than a verdict.
 */
export function buildLevers(
  assessment: Assessment,
  metrics: CalculatedMetrics,
  safety: SafetyFlags,
  assumptions: Assumptions,
): Lever[] {
  const levers: Lever[] = [];
  const { resilience, transactionCosts } = metrics;
  const commitments = assessment.essentialExpenses + assessment.existingDebtRepayments;

  // How much more cash would reach a comfortable buffer?
  if (resilience.bufferMonths < assumptions.resilience.moderate) {
    const target = commitments * assumptions.resilience.moderate;
    const extraNeeded = target - resilience.savingsRemaining;
    if (extraNeeded > 0) {
      levers.push({
        statement: `Building roughly ${formatCurrency(
          extraNeeded,
        )} more in accessible savings would leave you with about ${assumptions.resilience.moderate} months of expenses after the purchase, which would materially strengthen your position.`,
        category: 'savings',
      });
    }
  }

  // What price would the monthly budget actually support?
  if (safety.isUnaffordable || safety.strained) {
    const affordablePrice = estimateAffordablePrice(assessment, metrics, assumptions);
    if (affordablePrice > 0 && affordablePrice < assessment.propertyPrice) {
      levers.push({
        statement: `A property closer to ${formatCurrency(
          affordablePrice,
        )} would bring the total monthly cost within a comfortable share of your income.`,
        category: 'price',
      });
    }
  }

  // Rate sensitivity, expressed as what a one-point move costs per month.
  const rateSensitivity = estimateRateSensitivity(assessment, metrics);
  if (rateSensitivity > 0) {
    levers.push({
      statement: `Each one percentage point on your interest rate changes the bond repayment by roughly ${formatCurrency(
        rateSensitivity,
      )} a month. Negotiating a better rate is one of the few levers with an immediate effect.`,
      category: 'financing',
    });
  }

  // Time is often the decisive variable, so say so when it is.
  if (metrics.baseOutcome.favours !== 'buy') {
    levers.push({
      statement: `Buying tends to improve the longer you stay, because the upfront and selling costs of about ${formatCurrency(
        transactionCosts.total,
      )} are spread over more years. Staying longer than you currently expect would shift the comparison.`,
      category: 'time',
    });
  }

  if (metrics.horizonAssumed) {
    levers.push({
      statement:
        'You told us you were not sure how long you would stay, so we assumed five years. If you have a firmer view, it is worth running this again - the answer is sensitive to it.',
      category: 'time',
    });
  }

  return levers;
}

/**
 * Roughly what price keeps total ownership cost within the comfortable ratio.
 *
 * Solved directly rather than by search: ownership cost is linear in price
 * once the deposit is held fixed, so we can invert it.
 */
function estimateAffordablePrice(
  assessment: Assessment,
  metrics: CalculatedMetrics,
  assumptions: Assumptions,
): number {
  const budget = assessment.monthlyIncome * assumptions.affordability.comfortableHousingRatio;
  const costPerRandOfPrice = metrics.ownershipCosts.total / Math.max(assessment.propertyPrice, 1);
  if (costPerRandOfPrice <= 0) return 0;

  // Round down to the nearest R50,000 - false precision here would be worse
  // than useless, since it is an indicative target.
  return Math.floor(budget / costPerRandOfPrice / 50_000) * 50_000;
}

/** Change in monthly repayment from a one-percentage-point rate move. */
function estimateRateSensitivity(assessment: Assessment, metrics: CalculatedMetrics): number {
  const { loanAmount, annualRate } = metrics.mortgage;
  if (loanAmount <= 0) return 0;

  const n = assessment.loanTermYears * 12;
  const payment = (rate: number): number => {
    const i = rate / 12;
    if (i === 0) return loanAmount / n;
    const g = Math.pow(1 + i, n);
    return (loanAmount * i * g) / (g - 1);
  };

  return Math.abs(payment(annualRate + 0.01) - payment(annualRate));
}
