/**
 * Flattens a ReportModel into the internal record row.
 *
 * Kept separate from whatever writes the row, so the same mapping serves the
 * online spreadsheet, a future database, or a CSV without change. This is also
 * the single place to check when asking "what do we actually store?", which is
 * why the privacy test points at it.
 */

import type { ReportModel } from '../../models/results';
import type { ScenarioName } from '../../models/results';
import type { AssessmentRecord } from './types';

/** Rounds to whole rands; the export is for analysis, not accounting. */
const money = (value: number): number => Math.round(value);
const score = (value: number): number => Math.round(value * 10) / 10;

export function toRecord(report: ReportModel): AssessmentRecord {
  const { assessment, metrics, decision } = report;

  const scenario = (name: ScenarioName) =>
    metrics.scenarios.find((entry) => entry.name === name)?.outcome;

  const conservative = scenario('conservative');
  const base = scenario('base');
  const optimistic = scenario('optimistic');

  return {
    assessment_id: assessment.id,
    timestamp: assessment.createdAt,

    income: money(assessment.monthlyIncome),
    essential_expenses: money(assessment.essentialExpenses),
    existing_debt: money(assessment.existingDebtRepayments),
    savings: money(assessment.accessibleSavings),
    current_rent: money(assessment.currentRent),
    property_price: money(assessment.propertyPrice),
    upfront_contribution: money(assessment.upfrontContribution),
    interest_rate: metrics.mortgage.annualRate,
    interest_rate_assumed: metrics.mortgage.usedDefaultRate,
    loan_term: assessment.loanTermYears,
    expected_stay: assessment.expectedStay,
    move_likelihood: assessment.moveLikelihood,
    flexibility: assessment.flexibilityImportance,
    ownership_preference: assessment.ownershipImportance,
    risk_tolerance: assessment.riskTolerance,
    // Multiple priorities are possible; we export them joined rather than
    // losing all but the first.
    primary_priority: assessment.priorities.join('; '),

    monthly_bond: money(metrics.mortgage.monthlyPayment),
    monthly_ownership_cost: money(metrics.ownershipCosts.total),
    monthly_surplus: money(metrics.position.monthlySurplusAfterHousing),
    upfront_costs: money(metrics.transactionCosts.total),
    remaining_savings: money(metrics.resilience.savingsRemaining),
    emergency_buffer_months: score(metrics.resilience.bufferMonths),
    projected_rent_cost: money(metrics.baseOutcome.totalRentPaid),
    projected_buying_cost: money(metrics.baseOutcome.totalOwnershipCost),
    projected_equity: money(metrics.baseOutcome.netEquityOnSale),
    net_advantage_of_buying: money(metrics.baseOutcome.netAdvantageOfBuying),

    // Scenario results are stored explicitly so an analyst can see how
    // sensitive each assessment was without re-running the model.
    conservative_net_advantage: money(conservative?.netAdvantageOfBuying ?? 0),
    conservative_favours: conservative?.favours ?? '',
    base_net_advantage: money(base?.netAdvantageOfBuying ?? 0),
    base_favours: base?.favours ?? '',
    optimistic_net_advantage: money(optimistic?.netAdvantageOfBuying ?? 0),
    optimistic_favours: optimistic?.favours ?? '',

    financial_score: score(metrics.scores.financialPosition),
    resilience_score: score(metrics.scores.resilience),
    financial_outcome_score: score(metrics.scores.financialOutcome),
    personal_fit_score: score(metrics.scores.personalFit),

    recommendation: decision.recommendation,
    recommendation_robustness: `${decision.robustness.supporting}/${decision.robustness.total}`,
    scenario_sensitive: decision.robustness.sensitive,
    primary_reason: decision.strongestFactor?.statement ?? '',
    primary_risk: decision.biggestRisk?.statement ?? '',
  };
}

/**
 * Column order for the spreadsheet, with readable headers for an analyst.
 *
 * The serverless function derives its header row from this list, so the sheet
 * and the record cannot drift apart.
 */
export const EXPORT_COLUMNS: ReadonlyArray<{ key: keyof AssessmentRecord; header: string }> = [
  { key: 'assessment_id', header: 'Assessment ID' },
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'income', header: 'Monthly income' },
  { key: 'essential_expenses', header: 'Essential expenses' },
  { key: 'existing_debt', header: 'Existing debt repayments' },
  { key: 'savings', header: 'Accessible savings' },
  { key: 'current_rent', header: 'Current rent' },
  { key: 'property_price', header: 'Property price' },
  { key: 'upfront_contribution', header: 'Upfront contribution' },
  { key: 'interest_rate', header: 'Interest rate' },
  { key: 'interest_rate_assumed', header: 'Rate assumed?' },
  { key: 'loan_term', header: 'Loan term (years)' },
  { key: 'expected_stay', header: 'Expected stay' },
  { key: 'move_likelihood', header: 'Move likelihood' },
  { key: 'flexibility', header: 'Flexibility (1-5)' },
  { key: 'ownership_preference', header: 'Ownership importance (1-5)' },
  { key: 'risk_tolerance', header: 'Risk tolerance (1-5)' },
  { key: 'primary_priority', header: 'Priorities' },
  { key: 'monthly_bond', header: 'Monthly bond' },
  { key: 'monthly_ownership_cost', header: 'Monthly ownership cost' },
  { key: 'monthly_surplus', header: 'Monthly surplus after housing' },
  { key: 'upfront_costs', header: 'Estimated upfront costs' },
  { key: 'remaining_savings', header: 'Savings remaining' },
  { key: 'emergency_buffer_months', header: 'Buffer (months)' },
  { key: 'projected_rent_cost', header: 'Projected rent paid' },
  { key: 'projected_buying_cost', header: 'Projected cost of owning' },
  { key: 'projected_equity', header: 'Projected equity on sale' },
  { key: 'net_advantage_of_buying', header: 'Net advantage of buying' },
  { key: 'conservative_net_advantage', header: 'Conservative: net advantage' },
  { key: 'conservative_favours', header: 'Conservative: favours' },
  { key: 'base_net_advantage', header: 'Base: net advantage' },
  { key: 'base_favours', header: 'Base: favours' },
  { key: 'optimistic_net_advantage', header: 'Optimistic: net advantage' },
  { key: 'optimistic_favours', header: 'Optimistic: favours' },
  { key: 'financial_score', header: 'Financial position score' },
  { key: 'resilience_score', header: 'Resilience score' },
  { key: 'financial_outcome_score', header: 'Financial outcome score' },
  { key: 'personal_fit_score', header: 'Personal fit score' },
  { key: 'recommendation', header: 'Recommendation' },
  { key: 'recommendation_robustness', header: 'Robustness' },
  { key: 'scenario_sensitive', header: 'Sensitive to assumptions?' },
  { key: 'primary_reason', header: 'Primary reason' },
  { key: 'primary_risk', header: 'Primary risk' },
];
