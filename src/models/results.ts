/**
 * Everything the engine produces. The pipeline is:
 *
 *   Assessment -> CalculatedMetrics -> DecisionResult -> ReportModel -> UI
 *
 * Each stage is a plain data structure, so every stage is independently
 * testable and the UI never has to compute anything.
 */

import type { Assessment } from './assessment';

export interface MortgageBreakdown {
  loanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  totalRepaid: number;
  /** True when we substituted the default rate because the customer didn't know theirs. */
  usedDefaultRate: boolean;
  annualRate: number;
}

export interface TransactionCosts {
  transferDuty: number;
  conveyancing: number;
  bondRegistration: number;
  deedsOffice: number;
  sundries: number;
  total: number;
}

export interface OwnershipCosts {
  mortgage: number;
  ratesAndTaxes: number;
  insurance: number;
  maintenance: number;
  levies: number;
  total: number;
}

export interface FinancialPosition {
  /** Surplus before any housing cost: I - E - D. */
  monthlySurplusBeforeHousing: number;
  /** Surplus after the modelled ownership cost: I - E - D - H. */
  monthlySurplusAfterHousing: number;
  /** Surplus if the customer keeps renting at their current rent. */
  monthlySurplusIfRenting: number;
  housingCostRatio: number;
  totalDebtRatio: number;
  /** True when ownership costs exceed available income. */
  isUnaffordable: boolean;
}

export type ResilienceBand = 'strong' | 'moderate' | 'limited' | 'very_limited';

export interface Resilience {
  savingsRemaining: number;
  /** Months of essential expenses + debt the remaining savings would cover. */
  bufferMonths: number;
  band: ResilienceBand;
  /** True when savings cannot cover deposit + costs at all. */
  shortfall: number;
  canCoverUpfront: boolean;
}

/** Outcome of the buy-vs-rent comparison over the holding period. */
export interface ComparisonOutcome {
  years: number;
  /** Total cash spent on renting over the period. */
  totalRentPaid: number;
  /** Total cash spent on owning (incl. upfront and selling costs). */
  totalOwnershipCost: number;
  /** Property value at the end of the holding period. */
  projectedPropertyValue: number;
  /** Outstanding loan balance at the end. */
  outstandingLoan: number;
  /** Equity after selling costs. */
  netEquityOnSale: number;
  /** Renter's investment pot: capital not spent, plus monthly savings differences. */
  renterInvestedCapital: number;
  /** Net worth from buying minus net worth from renting. Positive favours buying. */
  netAdvantageOfBuying: number;
  favours: 'buy' | 'rent' | 'neutral';
}

export type ScenarioName = 'conservative' | 'base' | 'optimistic';

export interface ScenarioResult {
  name: ScenarioName;
  label: string;
  description: string;
  outcome: ComparisonOutcome;
}

export interface SectionScores {
  financialPosition: number;
  resilience: number;
  financialOutcome: number;
  personalFit: number;
}

export interface CalculatedMetrics {
  mortgage: MortgageBreakdown;
  transactionCosts: TransactionCosts;
  ownershipCosts: OwnershipCosts;
  position: FinancialPosition;
  resilience: Resilience;
  scenarios: ScenarioResult[];
  baseOutcome: ComparisonOutcome;
  scores: SectionScores;
  horizonYears: number;
  /** True when the horizon was assumed because the customer was unsure. */
  horizonAssumed: boolean;
}

export type Recommendation =
  | 'BUYING_LOOKS_ATTRACTIVE'
  | 'BUYING_MAY_WORK'
  | 'RENT_FOR_NOW';

export type ReasonCategory =
  | 'financial_position'
  | 'resilience'
  | 'financial_outcome'
  | 'personal_fit';

export type Impact = 'positive' | 'negative' | 'neutral';

/**
 * A single traceable statement behind the recommendation. The UI renders
 * these; it never composes its own reasoning.
 */
export interface Reason {
  category: ReasonCategory;
  statement: string;
  impact: Impact;
  /** Ranks reasons so the report can lead with what mattered most. */
  weight: number;
}

export interface Risk {
  statement: string;
  severity: 'high' | 'medium' | 'low';
}

export interface Lever {
  statement: string;
  /** What the customer would change, for grouping in the UI. */
  category: 'savings' | 'price' | 'financing' | 'time' | 'income';
}

export interface Robustness {
  supporting: number;
  total: number;
  /** True when scenarios disagree about the direction of the answer. */
  sensitive: boolean;
}

export interface DecisionResult {
  recommendation: Recommendation;
  headline: string;
  summary: string;
  reasons: Reason[];
  risks: Risk[];
  whatCouldChange: Lever[];
  robustness: Robustness;
  /** The single strongest supporting factor, for the result page. */
  strongestFactor: Reason | null;
  /** The single most material risk, for the result page. */
  biggestRisk: Risk | null;
}

export interface ReportModel {
  assessment: Assessment;
  metrics: CalculatedMetrics;
  decision: DecisionResult;
  /** Plain-English narrative. Deterministic template by default; AI may rewrite. */
  explanation: string;
  explanationSource: 'template' | 'ai';
}
