/**
 * Assembles the final ReportModel.
 *
 * This is the single entry point the UI calls. It runs the deterministic
 * pipeline first and only then asks for a narrative, which guarantees that the
 * numbers exist and are final before any optional AI is involved.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import { decide } from '../calculations/decisionEngine';
import { calculateMetrics } from '../calculations/metrics';
import type { Assessment } from '../models/assessment';
import type { ReportModel } from '../models/results';
import { buildExplanationInput, createExplanationService } from './explanation';
import type { ExplanationService } from './explanation/types';

export async function buildReport(
  assessment: Assessment,
  options: { explanationService?: ExplanationService; assumptions?: Assumptions } = {},
): Promise<ReportModel> {
  const assumptions = options.assumptions ?? DEFAULT_ASSUMPTIONS;

  // Deterministic core - always runs, always complete on its own.
  const metrics = calculateMetrics(assessment, assumptions);
  const decision = decide(assessment, metrics, assumptions);

  const service = options.explanationService ?? createExplanationService();

  let explanation: string;
  let explanationSource: ReportModel['explanationSource'];
  try {
    explanation = await service.explain(buildExplanationInput(assessment, metrics, decision));
    // Read after the call, not before: a service that falls back internally
    // reports 'template' here, so the report records what the customer
    // actually saw rather than what we hoped to give them.
    explanationSource = service.source;
  } catch {
    // The narrative is presentation. Losing it must never cost the customer
    // their report, so we fall back to the engine's own summary.
    explanation = decision.summary;
    explanationSource = 'template';
  }

  return { assessment, metrics, decision, explanation, explanationSource };
}
