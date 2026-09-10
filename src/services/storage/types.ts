import type { ReportModel } from '../../models/results';

/**
 * What happened to the internal record.
 *
 * Three outcomes rather than a thrown error, because two of them are not
 * failures: 'not_configured' is a perfectly valid deployment, and even
 * 'failed' must leave the customer's journey untouched.
 */
export type SaveOutcome =
  | { status: 'saved' }
  | { status: 'not_configured' }
  | { status: 'failed'; reason: string };

/**
 * The persistence boundary.
 *
 * Kept as an interface because there genuinely are two implementations (the
 * serverless spreadsheet writer and a no-op), and because the analytics store
 * is the part of this system most likely to be replaced. Nothing above this
 * interface knows which provider is behind it.
 */
export interface AssessmentRepository {
  save(report: ReportModel): Promise<SaveOutcome>;
}

/**
 * One flat row per completed assessment. Raw inputs come first, then derived
 * values, so an analyst can tell at a glance what the customer said and what
 * the model concluded.
 *
 * Note what is absent: no name, contact details, identity number, address,
 * employer, date of birth or banking information. The model does not need any
 * of it, so it is never collected. See docs/data-model.md.
 */
export interface AssessmentRecord {
  assessment_id: string;
  timestamp: string;

  // --- Raw inputs ---
  income: number;
  essential_expenses: number;
  existing_debt: number;
  savings: number;
  current_rent: number;
  property_price: number;
  upfront_contribution: number;
  interest_rate: number;
  interest_rate_assumed: boolean;
  loan_term: number;
  expected_stay: string;
  move_likelihood: string;
  flexibility: number;
  ownership_preference: number;
  risk_tolerance: number;
  primary_priority: string;

  // --- Calculated outputs ---
  monthly_bond: number;
  monthly_ownership_cost: number;
  monthly_surplus: number;
  upfront_costs: number;
  remaining_savings: number;
  emergency_buffer_months: number;
  projected_rent_cost: number;
  projected_buying_cost: number;
  projected_equity: number;
  net_advantage_of_buying: number;

  // --- Scenario results ---
  conservative_net_advantage: number;
  conservative_favours: string;
  base_net_advantage: number;
  base_favours: string;
  optimistic_net_advantage: number;
  optimistic_favours: string;

  // --- Scores and decision ---
  financial_score: number;
  resilience_score: number;
  financial_outcome_score: number;
  personal_fit_score: number;
  recommendation: string;
  recommendation_robustness: string;
  scenario_sensitive: boolean;
  primary_reason: string;
  primary_risk: string;
}
