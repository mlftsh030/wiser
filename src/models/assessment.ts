/**
 * The customer's answers. This is raw input only - nothing derived.
 * Keeping inputs and calculated values in separate types is what lets us
 * export them as clearly separated columns and re-run the engine on old data.
 */

export type ExpectedStay =
  | 'under_3'
  | '3_to_5'
  | '5_to_10'
  | 'over_10'
  | 'unsure';

export type MoveLikelihood =
  | 'very_unlikely'
  | 'unlikely'
  | 'unsure'
  | 'likely'
  | 'very_likely';

export type Priority =
  | 'low_monthly_costs'
  | 'build_wealth'
  | 'flexibility'
  | 'stable_housing'
  | 'own_asset'
  | 'keep_savings'
  | 'avoid_debt';

/** 1-5 Likert responses. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Assessment {
  /** Generated, non-identifying. See docs/data-model.md on privacy. */
  id: string;
  createdAt: string;

  // --- Financial position ---
  monthlyIncome: number;
  essentialExpenses: number;
  existingDebtRepayments: number;
  accessibleSavings: number;

  // --- Housing ---
  currentRent: number;
  propertyPrice: number;
  upfrontContribution: number;

  // --- Financing ---
  /** null means "I don't know" - the engine substitutes a labelled default. */
  interestRate: number | null;
  loanTermYears: number;

  // --- Future ---
  expectedStay: ExpectedStay;
  moveLikelihood: MoveLikelihood;

  // --- Preferences ---
  flexibilityImportance: Rating;
  ownershipImportance: Rating;
  riskTolerance: Rating;
  priorities: Priority[];
}

/** Map the qualitative stay answer onto a modelling horizon in years. */
export const EXPECTED_STAY_YEARS: Record<ExpectedStay, number> = {
  under_3: 2,
  '3_to_5': 4,
  '5_to_10': 7,
  over_10: 12,
  // When unsure we model a middling horizon rather than a favourable one,
  // and the report says explicitly that we assumed it.
  unsure: 5,
};
