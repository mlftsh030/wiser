import type { Assessment } from '../../models/assessment';

/**
 * A financially comfortable baseline customer. Tests override single fields
 * from here so that each test states only what it is actually varying.
 */
export const baseAssessment: Assessment = {
  id: 'test-assessment',
  createdAt: '2026-01-01T00:00:00.000Z',
  monthlyIncome: 60_000,
  essentialExpenses: 18_000,
  existingDebtRepayments: 4_000,
  accessibleSavings: 600_000,
  currentRent: 12_000,
  propertyPrice: 1_800_000,
  upfrontContribution: 300_000,
  interestRate: 0.1075,
  loanTermYears: 20,
  expectedStay: '5_to_10',
  moveLikelihood: 'unlikely',
  flexibilityImportance: 2,
  ownershipImportance: 4,
  riskTolerance: 3,
  priorities: ['build_wealth', 'stable_housing'],
};

export const make = (overrides: Partial<Assessment>): Assessment => ({
  ...baseAssessment,
  ...overrides,
});
