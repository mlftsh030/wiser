import type { DecisionResult, CalculatedMetrics } from '../../models/results';
import type { Assessment } from '../../models/assessment';

/**
 * The narrative layer. Two implementations satisfy this interface: a
 * deterministic template and an optional AI rewrite. The application depends
 * on the interface, never on either implementation, so removing the AI changes
 * nothing about how the app works.
 */
export interface ExplanationService {
  /**
   * Where the narrative came from. Not readonly, because a service that falls
   * back internally must be able to report the truth: reportBuilder reads this
   * after explain() resolves.
   */
  source: 'template' | 'ai';
  explain(input: ExplanationInput): Promise<string>;
}

/**
 * Only already-calculated facts are passed in. The AI is never given raw
 * inputs to reason about, and never asked to produce a number of its own.
 */
export interface ExplanationInput {
  recommendation: DecisionResult['recommendation'];
  headline: string;
  summary: string;
  scores: CalculatedMetrics['scores'];
  keyDrivers: string[];
  risks: string[];
  scenarios: { label: string; favours: string }[];
  robustness: DecisionResult['robustness'];
  horizonYears: number;
}

export function buildExplanationInput(
  _assessment: Assessment,
  metrics: CalculatedMetrics,
  decision: DecisionResult,
): ExplanationInput {
  return {
    recommendation: decision.recommendation,
    headline: decision.headline,
    summary: decision.summary,
    scores: metrics.scores,
    keyDrivers: decision.reasons.slice(0, 3).map((r) => r.statement),
    risks: decision.risks.slice(0, 2).map((r) => r.statement),
    scenarios: metrics.scenarios.map((s) => ({ label: s.label, favours: s.outcome.favours })),
    robustness: decision.robustness,
    horizonYears: metrics.horizonYears,
  };
}
