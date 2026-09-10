/**
 * Orchestrates the calculation modules into a single CalculatedMetrics object.
 *
 * This is the only place that knows the order of the pipeline. Each individual
 * module stays ignorant of the others, which is what makes them testable in
 * isolation.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import { EXPECTED_STAY_YEARS, type Assessment } from '../models/assessment';
import type { CalculatedMetrics } from '../models/results';
import { calculateFinancialPosition, calculateResilience } from './affordability';
import { compareBuyVsRent, type ComparisonInput } from './comparison';
import { calculateMortgage } from './mortgage';
import { calculateOwnershipCosts } from './ownership';
import { runScenarios } from './scenarios';
import { calculateScores } from './scoring';
import { calculateTransactionCosts } from './transactionCosts';

export function calculateMetrics(
  assessment: Assessment,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): CalculatedMetrics {
  // A customer who does not know their rate still gets a full analysis; we
  // substitute the default and flag it everywhere it is used.
  const usedDefaultRate = assessment.interestRate === null;
  const annualRate = assessment.interestRate ?? assumptions.rates.defaultInterestRate;

  // The deposit cannot exceed the price - anything above it is not a loan.
  const loanAmount = Math.max(assessment.propertyPrice - assessment.upfrontContribution, 0);

  const mortgage = calculateMortgage(
    { loanAmount, annualRate, termYears: assessment.loanTermYears },
    usedDefaultRate,
  );

  const transactionCosts = calculateTransactionCosts(
    assessment.propertyPrice,
    loanAmount,
    assumptions,
  );

  const ownershipCosts = calculateOwnershipCosts(
    assessment.propertyPrice,
    mortgage.monthlyPayment,
    assumptions,
  );

  const position = calculateFinancialPosition(assessment, ownershipCosts.total);
  const resilience = calculateResilience(assessment, transactionCosts, assumptions);

  const horizonYears = EXPECTED_STAY_YEARS[assessment.expectedStay];
  const comparisonInput: ComparisonInput = {
    assessment,
    loanAmount,
    annualRate,
    monthlyMortgage: mortgage.monthlyPayment,
    transactionCosts,
    years: horizonYears,
  };

  const baseOutcome = compareBuyVsRent(comparisonInput, assumptions);
  const scenarios = runScenarios(comparisonInput, assumptions);

  return {
    mortgage,
    transactionCosts,
    ownershipCosts,
    position,
    resilience,
    scenarios,
    baseOutcome,
    scores: calculateScores(assessment, position, resilience, baseOutcome, scenarios, assumptions),
    horizonYears,
    horizonAssumed: assessment.expectedStay === 'unsure',
  };
}
