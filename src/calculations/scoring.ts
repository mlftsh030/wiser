/**
 * Section scores, 0-10.
 *
 * IMPORTANT: these are communication devices, not the decision algorithm. The
 * decision engine reads the underlying metrics directly. Scores exist so the
 * customer can see at a glance which part of their situation is strong and
 * which is weak - a high score never causes a "buy" on its own.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import { EXPECTED_STAY_YEARS, type Assessment } from '../models/assessment';
import type {
  ComparisonOutcome,
  FinancialPosition,
  Resilience,
  ScenarioResult,
  SectionScores,
} from '../models/results';

const clamp = (value: number, min = 0, max = 10): number =>
  Math.min(Math.max(value, min), max);

/** Linear interpolation of `value` between two reference points, onto 0-10. */
function scale(value: number, worst: number, best: number): number {
  if (best === worst) return 5;
  return clamp(((value - worst) / (best - worst)) * 10);
}

/**
 * How comfortably income covers the housing commitment.
 * Blends the share of income consumed with the absolute cash left over, so a
 * high earner with a large surplus is not penalised by ratio alone.
 */
export function scoreFinancialPosition(
  position: FinancialPosition,
  assessment: Assessment,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): number {
  const a = assumptions.affordability;

  // Ratio component: full marks at half the comfortable ceiling, zero at the
  // point where total debt service reaches what lenders treat as the limit.
  const ratioScore = scale(
    position.housingCostRatio,
    a.stretchedHousingRatio,
    a.comfortableHousingRatio / 2,
  );

  // Surplus component: measured in months of essential expenses covered by
  // what remains each month.
  const commitments = Math.max(assessment.essentialExpenses, 1);
  const surplusScore = scale(position.monthlySurplusAfterHousing / commitments, 0, 0.5);

  const debtPenalty = position.totalDebtRatio > a.maxTotalDebtRatio ? 2 : 0;

  return clamp((ratioScore * 0.5 + surplusScore * 0.5) - debtPenalty);
}

/** How much financial shock absorption survives the purchase. */
export function scoreResilience(
  resilience: Resilience,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): number {
  if (!resilience.canCoverUpfront) return 0;
  return scale(resilience.bufferMonths, 0, assumptions.resilience.strong);
}

/**
 * How favourable the long-term money outcome looks.
 *
 * Anchored on the net advantage of buying as a share of the property price, so
 * the score is comparable across price points. Scenario agreement nudges it:
 * a result that holds up under all three deserves more confidence.
 */
export function scoreFinancialOutcome(
  outcome: ComparisonOutcome,
  scenarios: ScenarioResult[],
  propertyPrice: number,
): number {
  const price = Math.max(propertyPrice, 1);
  const relative = outcome.netAdvantageOfBuying / price;

  // +/-25% of property value over the horizon spans decisively rent-favouring
  // to decisively buy-favouring.
  const base = scale(relative, -0.25, 0.25);

  const buyingScenarios = scenarios.filter((s) => s.outcome.favours === 'buy').length;
  const agreement = scenarios.length > 0 ? buyingScenarios / scenarios.length : 0;

  return clamp(base * 0.75 + agreement * 10 * 0.25);
}

const MOVE_LIKELIHOOD_SCORE: Record<Assessment['moveLikelihood'], number> = {
  very_unlikely: 10,
  unlikely: 7.5,
  unsure: 5,
  likely: 2.5,
  very_likely: 0,
};

/**
 * How well buying fits the customer's life and what they say they value.
 *
 * Deliberately not purely financial: someone who values flexibility highly and
 * expects to move is a poor fit for ownership even when the numbers work.
 */
export function scorePersonalFit(assessment: Assessment): number {
  const years = EXPECTED_STAY_YEARS[assessment.expectedStay];

  // Transaction costs need roughly five years of growth to recover, so the
  // horizon score rises steeply up to that point and then flattens.
  const horizonScore = scale(years, 1, 8);
  const mobilityScore = MOVE_LIKELIHOOD_SCORE[assessment.moveLikelihood];

  // Preferences are on a 1-5 scale; flexibility counts against ownership.
  const ownershipScore = ((assessment.ownershipImportance - 1) / 4) * 10;
  const flexibilityScore = ((5 - assessment.flexibilityImportance) / 4) * 10;
  const riskScore = ((assessment.riskTolerance - 1) / 4) * 10;

  const priorityAdjustment = scorePriorities(assessment.priorities);

  return clamp(
    horizonScore * 0.3 +
      mobilityScore * 0.2 +
      ownershipScore * 0.2 +
      flexibilityScore * 0.15 +
      riskScore * 0.15 +
      priorityAdjustment,
  );
}

/** Priorities that pull towards or away from ownership, worth +/-1 point total. */
function scorePriorities(priorities: Assessment['priorities']): number {
  const towardsBuying = ['build_wealth', 'own_asset', 'stable_housing'];
  const towardsRenting = ['flexibility', 'keep_savings', 'avoid_debt', 'low_monthly_costs'];

  const net =
    priorities.filter((p) => towardsBuying.includes(p)).length -
    priorities.filter((p) => towardsRenting.includes(p)).length;

  return Math.max(Math.min(net * 0.5, 1), -1);
}

export function calculateScores(
  assessment: Assessment,
  position: FinancialPosition,
  resilience: Resilience,
  outcome: ComparisonOutcome,
  scenarios: ScenarioResult[],
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): SectionScores {
  return {
    financialPosition: scoreFinancialPosition(position, assessment, assumptions),
    resilience: scoreResilience(resilience, assumptions),
    financialOutcome: scoreFinancialOutcome(outcome, scenarios, assessment.propertyPrice),
    personalFit: scorePersonalFit(assessment),
  };
}
