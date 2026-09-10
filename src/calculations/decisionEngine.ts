/**
 * The decision engine.
 *
 * Deliberately NOT "sum the scores and threshold them". Money does not work
 * that way: a strong personal fit cannot compensate for being unable to pay
 * the bond, so the stages are a hierarchy, not a weighted average.
 *
 *   Stage 1 - Financial safety.    A constraint. Fail it and the answer is
 *                                  "rent for now", whatever else is true.
 *   Stage 2 - Financial comparison. Over the customer's actual horizon, and
 *                                  across scenarios.
 *   Stage 3 - Personal circumstances. Can move the answer one step in either
 *                                  direction, never past the Stage 1 gate.
 *
 * The output is an explainable object: every recommendation carries the
 * reasons, risks and levers that produced it.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import type { Assessment } from '../models/assessment';
import type {
  CalculatedMetrics,
  DecisionResult,
  Reason,
  Recommendation,
  Risk,
  Robustness,
} from '../models/results';
import { formatCurrency, formatMonths } from '../utils/format';
import { buildLevers } from './levers';

/** Buffer below which we treat the purchase as leaving the household exposed. */
const MIN_SAFE_BUFFER_MONTHS = 3;
/** A surplus this thin leaves no room for a rate rise or a bad month. */
const THIN_SURPLUS_RATIO = 0.05;

export function decide(
  assessment: Assessment,
  metrics: CalculatedMetrics,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): DecisionResult {
  const reasons: Reason[] = [];
  const risks: Risk[] = [];

  const safety = assessSafety(assessment, metrics, reasons, risks, assumptions);
  const comparison = assessComparison(metrics, reasons);
  const fit = assessPersonalFit(assessment, metrics, reasons, risks);

  const recommendation = combine(safety, comparison, fit);
  const robustness = calculateRobustness(metrics, recommendation);

  if (robustness.sensitive) {
    risks.push({
      statement:
        'This result depends on how the property market performs. Under our more cautious assumptions, the answer changes.',
      severity: 'medium',
    });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const positives = reasons.filter((r) => r.impact === 'positive');
  const rankedRisks = rankRisks(risks);

  return {
    recommendation,
    headline: HEADLINES[recommendation],
    summary: buildSummary(recommendation, metrics, safety),
    reasons,
    risks: rankedRisks,
    whatCouldChange: buildLevers(
      assessment,
      metrics,
      { isUnaffordable: metrics.position.isUnaffordable, strained: safety.strained },
      assumptions,
    ),
    robustness,
    strongestFactor: positives[0] ?? reasons[0] ?? null,
    biggestRisk: rankedRisks[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Stage 1 - Financial safety
// ---------------------------------------------------------------------------

interface SafetyAssessment {
  /** Hard fail: the purchase cannot responsibly go ahead now. */
  blocked: boolean;
  /** Soft warning: it is possible, but tight. */
  strained: boolean;
  reasonCode: 'cannot_afford_monthly' | 'cannot_cover_upfront' | 'no_buffer' | 'thin_surplus' | null;
}

function assessSafety(
  assessment: Assessment,
  metrics: CalculatedMetrics,
  reasons: Reason[],
  risks: Risk[],
  assumptions: Assumptions,
): SafetyAssessment {
  const { position, resilience, ownershipCosts } = metrics;
  const result: SafetyAssessment = { blocked: false, strained: false, reasonCode: null };

  // 1a. Can the monthly cost be met from income at all?
  if (position.isUnaffordable) {
    result.blocked = true;
    result.reasonCode = 'cannot_afford_monthly';
    reasons.push({
      category: 'financial_position',
      statement: `The full monthly cost of owning this home (about ${formatCurrency(
        ownershipCosts.total,
      )}) is more than what is left of your income after your essential expenses and debt repayments.`,
      impact: 'negative',
      weight: 100,
    });
    risks.push({
      statement:
        'Buying at this price would mean spending more each month than you have coming in.',
      severity: 'high',
    });
  }

  // 1b. Is there enough cash to complete the transfer?
  if (!resilience.canCoverUpfront) {
    result.blocked = true;
    result.reasonCode = result.reasonCode ?? 'cannot_cover_upfront';
    reasons.push({
      category: 'resilience',
      statement: `Your deposit plus the estimated purchase costs come to about ${formatCurrency(
        assessment.upfrontContribution + metrics.transactionCosts.total,
      )}, which is roughly ${formatCurrency(resilience.shortfall)} more than your accessible savings.`,
      impact: 'negative',
      weight: 95,
    });
    risks.push({
      statement: `You would be about ${formatCurrency(
        resilience.shortfall,
      )} short of the cash needed to complete the purchase.`,
      severity: 'high',
    });
  }

  // 1c. Would the purchase wipe out the emergency buffer?
  if (resilience.canCoverUpfront && resilience.bufferMonths < MIN_SAFE_BUFFER_MONTHS) {
    result.strained = true;
    result.reasonCode = result.reasonCode ?? 'no_buffer';
    const severity = resilience.bufferMonths < 1 ? 'high' : 'medium';
    if (resilience.bufferMonths < 1) result.blocked = true;

    reasons.push({
      category: 'resilience',
      statement: `After the deposit and purchase costs you would have about ${formatCurrency(
        resilience.savingsRemaining,
      )} left, roughly ${formatMonths(resilience.bufferMonths)} of essential expenses.`,
      impact: 'negative',
      weight: 90,
    });
    risks.push({
      statement: `The purchase would reduce your accessible savings to approximately ${formatMonths(
        resilience.bufferMonths,
      )} of essential expenses, leaving little room for an emergency.`,
      severity,
    });
  }

  // 1d. Is the monthly surplus so thin that a rate rise would break it?
  const surplusRatio =
    assessment.monthlyIncome > 0
      ? position.monthlySurplusAfterHousing / assessment.monthlyIncome
      : 0;

  if (!position.isUnaffordable && surplusRatio < THIN_SURPLUS_RATIO) {
    result.strained = true;
    result.reasonCode = result.reasonCode ?? 'thin_surplus';
    reasons.push({
      category: 'financial_position',
      statement: `Owning would leave you with about ${formatCurrency(
        position.monthlySurplusAfterHousing,
      )} a month after essentials, debt and housing costs. That is a thin margin if interest rates rise.`,
      impact: 'negative',
      weight: 85,
    });
    risks.push({
      statement:
        'Very little income would be left over each month, so an interest-rate increase or an unexpected bill would be difficult to absorb.',
      severity: 'medium',
    });
  }

  // Positive framing when safety is comfortably satisfied.
  if (!result.blocked && !result.strained) {
    reasons.push({
      category: 'financial_position',
      statement: `The monthly cost of owning would take about ${Math.round(
        position.housingCostRatio * 100,
      )}% of your take-home income, leaving roughly ${formatCurrency(
        position.monthlySurplusAfterHousing,
      )} a month after your essentials and debt.`,
      impact: 'positive',
      weight: 70,
    });

    if (resilience.band === 'strong' || resilience.band === 'moderate') {
      reasons.push({
        category: 'resilience',
        statement: `You would still have around ${formatCurrency(
          resilience.savingsRemaining,
        )} accessible afterwards, about ${formatMonths(
          resilience.bufferMonths,
        )} of essential expenses.`,
        impact: 'positive',
        weight: 65,
      });
    }
  }

  // Note when the customer is already stretched even as a renter - this is
  // about their budget, not about buying, and it deserves saying separately.
  if (position.monthlySurplusIfRenting < 0) {
    risks.push({
      statement:
        'Your current rent and commitments already exceed your take-home income, so the pressure here is not only about buying.',
      severity: 'high',
    });
  }

  void assumptions;
  return result;
}

// ---------------------------------------------------------------------------
// Stage 2 - Financial comparison
// ---------------------------------------------------------------------------

type ComparisonVerdict = 'favours_buying' | 'close' | 'favours_renting';

interface ComparisonAssessment {
  verdict: ComparisonVerdict;
  /**
   * True when the gap is large enough that personal preference should not be
   * able to overturn it. Without this, a strong "personal fit" could flip a
   * clearly loss-making purchase into a recommendation - which is precisely
   * the kind of unexplainable jump this engine exists to avoid.
   */
  decisive: boolean;
}

/** Net advantage beyond this share of the property price is treated as decisive. */
const DECISIVE_ADVANTAGE_RATIO = 0.1;

function assessComparison(
  metrics: CalculatedMetrics,
  reasons: Reason[],
): ComparisonAssessment {
  const { baseOutcome, horizonYears, horizonAssumed } = metrics;
  const verdict: ComparisonVerdict =
    baseOutcome.favours === 'buy'
      ? 'favours_buying'
      : baseOutcome.favours === 'rent'
        ? 'favours_renting'
        : 'close';

  const horizonPhrase = horizonAssumed
    ? `over the ${horizonYears} years we assumed, since you were not sure how long you would stay`
    : `over the roughly ${horizonYears} years you expect to stay`;

  if (verdict === 'favours_buying') {
    reasons.push({
      category: 'financial_outcome',
      statement: `On our central assumptions, buying leaves you around ${formatCurrency(
        Math.abs(baseOutcome.netAdvantageOfBuying),
      )} better off than renting ${horizonPhrase}, once selling costs and the return you could earn on your deposit are taken into account.`,
      impact: 'positive',
      weight: 80,
    });
  } else if (verdict === 'favours_renting') {
    reasons.push({
      category: 'financial_outcome',
      statement: `On our central assumptions, renting leaves you around ${formatCurrency(
        Math.abs(baseOutcome.netAdvantageOfBuying),
      )} better off ${horizonPhrase}, largely because the upfront and selling costs of buying are not recovered in that time.`,
      impact: 'negative',
      weight: 80,
    });
  } else {
    reasons.push({
      category: 'financial_outcome',
      statement: `Financially the two options land close together ${horizonPhrase}. There is no clear money-based winner, which means the decision comes down to what suits your life.`,
      impact: 'neutral',
      weight: 75,
    });
  }

  const propertyPrice = Math.max(metrics.baseOutcome.projectedPropertyValue, 1);
  const decisive =
    Math.abs(baseOutcome.netAdvantageOfBuying) / propertyPrice > DECISIVE_ADVANTAGE_RATIO;

  return { verdict, decisive };
}

// ---------------------------------------------------------------------------
// Stage 3 - Personal circumstances
// ---------------------------------------------------------------------------

type FitVerdict = 'supports_buying' | 'neutral' | 'supports_renting';

function assessPersonalFit(
  assessment: Assessment,
  metrics: CalculatedMetrics,
  reasons: Reason[],
  risks: Risk[],
): FitVerdict {
  const fit = metrics.scores.personalFit;
  const shortStay = assessment.expectedStay === 'under_3';
  const likelyToMove =
    assessment.moveLikelihood === 'likely' || assessment.moveLikelihood === 'very_likely';

  if (shortStay || likelyToMove) {
    reasons.push({
      category: 'personal_fit',
      statement: shortStay
        ? 'You expect to be in this home for less than three years. Buying and selling costs are usually not recovered over such a short period.'
        : 'You think you are likely to move within the next five years, and the costs of buying then selling are substantial.',
      impact: 'negative',
      weight: 88,
    });
    risks.push({
      statement:
        'If you sell within a few years, agent commission and transfer costs are likely to outweigh any growth in the property value.',
      severity: 'high',
    });
    return 'supports_renting';
  }

  if (fit >= 7) {
    reasons.push({
      category: 'personal_fit',
      statement: `Your expected ${metrics.horizonYears}-year stay and how much owning matters to you both point towards buying suiting your circumstances.`,
      impact: 'positive',
      weight: 78,
    });
    return 'supports_buying';
  }

  if (fit <= 4) {
    reasons.push({
      category: 'personal_fit',
      statement:
        'What you told us you value - particularly flexibility - fits renting more comfortably than ownership right now.',
      impact: 'negative',
      weight: 72,
    });
    return 'supports_renting';
  }

  reasons.push({
    category: 'personal_fit',
    statement:
      'Your plans and preferences do not point strongly in either direction, so the financial side carries more of the weight here.',
    impact: 'neutral',
    weight: 60,
  });
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Combining the stages
// ---------------------------------------------------------------------------

function combine(
  safety: SafetyAssessment,
  comparison: ComparisonAssessment,
  fit: FitVerdict,
): Recommendation {
  // Stage 1 is a gate, not a factor.
  if (safety.blocked) return 'RENT_FOR_NOW';

  // Baseline from the financial comparison.
  let level: 0 | 1 | 2 =
    comparison.verdict === 'favours_buying' ? 2 : comparison.verdict === 'close' ? 1 : 0;

  // Personal circumstances move the answer at most one step, and only when the
  // financial comparison is not already pointing the other way. Preference can
  // break a tie; it cannot overturn a comparison that favours renting, however
  // narrowly. Allowing that would let us recommend buying while most of our own
  // scenarios disagreed - the kind of unexplainable jump this engine avoids.
  const financeAllowsPromotion =
    !comparison.decisive && comparison.verdict !== 'favours_renting';

  if (fit === 'supports_buying' && level < 2 && financeAllowsPromotion) {
    level = (level + 1) as 1 | 2;
  }
  // Reasons to rent always apply: they reduce, never inflate, the answer.
  if (fit === 'supports_renting' && level > 0) level = (level - 1) as 0 | 1;

  // Being financially stretched caps the answer: we will not call a purchase
  // "attractive" when it leaves the household without a cushion.
  if (safety.strained && level === 2) level = 1;

  return level === 2
    ? 'BUYING_LOOKS_ATTRACTIVE'
    : level === 1
      ? 'BUYING_MAY_WORK'
      : 'RENT_FOR_NOW';
}

const HEADLINES: Record<Recommendation, string> = {
  BUYING_LOOKS_ATTRACTIVE: 'Buying looks attractive',
  BUYING_MAY_WORK: 'Buying may work',
  RENT_FOR_NOW: 'Renting looks like the stronger option for now',
};

function buildSummary(
  recommendation: Recommendation,
  metrics: CalculatedMetrics,
  safety: SafetyAssessment,
): string {
  const monthly = formatCurrency(metrics.ownershipCosts.total);

  switch (recommendation) {
    case 'BUYING_LOOKS_ATTRACTIVE':
      return `Based on the assumptions you provided, buying looks financially attractive. The full monthly cost of about ${monthly} sits comfortably within your income, and over your expected stay the numbers work in favour of owning.`;
    case 'BUYING_MAY_WORK':
      return safety.strained
        ? `Based on the assumptions you provided, buying could work, but it would leave you with less cash available for emergencies than we would usually be comfortable with.`
        : `Based on the assumptions you provided, buying could work for you, though the case is not clear-cut and depends on assumptions that may not hold.`;
    case 'RENT_FOR_NOW':
      return safety.blocked
        ? `Based on the assumptions you provided, this purchase would put real strain on your finances. Renting for now looks like the safer position while you strengthen it.`
        : `Based on the assumptions you provided, renting looks like the stronger option for now, mainly because of how the costs of buying compare over the time you expect to stay.`;
  }
}

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

/**
 * How many scenarios point the same way as the recommendation.
 *
 * This is a measure of sensitivity to our assumptions, not statistical
 * confidence, and the UI is careful to say so.
 */
export function calculateRobustness(
  metrics: CalculatedMetrics,
  recommendation: Recommendation,
): Robustness {
  // A scenario "supports" the recommendation when it does not point away from
  // it. For the hedged answer a close-to-even scenario counts, but one that
  // clearly favours renting does not - otherwise we would report full
  // agreement while the central case actually favours renting.
  const supports = (favours: 'buy' | 'rent' | 'neutral'): boolean => {
    switch (recommendation) {
      case 'BUYING_LOOKS_ATTRACTIVE':
        return favours === 'buy';
      case 'BUYING_MAY_WORK':
        return favours !== 'rent';
      case 'RENT_FOR_NOW':
        return favours !== 'buy';
    }
  };

  const supporting = metrics.scenarios.filter((s) => supports(s.outcome.favours)).length;

  const total = metrics.scenarios.length;
  const directions = new Set(metrics.scenarios.map((s) => s.outcome.favours));

  return {
    supporting,
    total,
    // Sensitive when the scenarios genuinely disagree about direction, i.e.
    // at least one favours buying and at least one favours renting.
    sensitive: directions.has('buy') && directions.has('rent'),
  };
}

/** Most severe first, so the report leads with what matters most. */
function rankRisks(risks: Risk[]): Risk[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...risks].sort((a, b) => order[a.severity] - order[b.severity]);
}
