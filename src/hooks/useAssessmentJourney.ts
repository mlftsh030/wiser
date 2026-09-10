/**
 * Journey state.
 *
 * Plain React state - no state library. The journey is a short linear flow
 * with one draft object, and adding Redux or Zustand here would be complexity
 * without benefit.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Assessment, MoveLikelihood, Priority, Rating, ExpectedStay } from '../models/assessment';

export const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'situation', title: 'Your situation' },
  { id: 'home', title: 'Your home' },
  { id: 'financing', title: 'Financing' },
  { id: 'future', title: 'Your future' },
  { id: 'priorities', title: 'What matters' },
  { id: 'result', title: 'Your result' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

/** Numbers are nullable while the customer is still filling the form in. */
export interface JourneyDraft {
  monthlyIncome: number | null;
  essentialExpenses: number | null;
  existingDebtRepayments: number | null;
  accessibleSavings: number | null;
  currentRent: number | null;
  propertyPrice: number | null;
  upfrontContribution: number | null;
  interestRate: number | null;
  rateUnknown: boolean;
  loanTermYears: number;
  expectedStay: ExpectedStay | null;
  moveLikelihood: MoveLikelihood | null;
  flexibilityImportance: Rating;
  ownershipImportance: Rating;
  riskTolerance: Rating;
  priorities: Priority[];
}

const INITIAL_DRAFT: JourneyDraft = {
  monthlyIncome: null,
  essentialExpenses: null,
  existingDebtRepayments: null,
  accessibleSavings: null,
  currentRent: null,
  propertyPrice: null,
  upfrontContribution: null,
  interestRate: null,
  rateUnknown: false,
  loanTermYears: 20,
  expectedStay: null,
  moveLikelihood: null,
  // Mid-scale defaults: a slider must start somewhere, and the middle is the
  // only starting point that does not nudge the answer.
  flexibilityImportance: 3,
  ownershipImportance: 3,
  riskTolerance: 3,
  priorities: [],
};

export function useAssessmentJourney() {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<JourneyDraft>(INITIAL_DRAFT);

  const update = useCallback(<K extends keyof JourneyDraft>(key: K, value: JourneyDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const next = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
    // Each step is a new page in the story, so start it at the top.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const back = useCallback(() => {
    setStepIndex((index) => Math.max(index - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const restart = useCallback(() => {
    setDraft(INITIAL_DRAFT);
    setStepIndex(0);
    window.scrollTo({ top: 0 });
  }, []);

  const step = STEPS[stepIndex];

  /** Question steps only - the welcome and result pages are not "progress". */
  const progress = useMemo(() => {
    const questionSteps = STEPS.length - 2;
    return { current: Math.min(stepIndex, questionSteps), total: questionSteps };
  }, [stepIndex]);

  return { step, stepIndex, draft, update, next, back, restart, progress };
}

/**
 * Converts the completed draft into a validated Assessment.
 *
 * Called only once every step has passed validation, so the non-null
 * assertions here are safe; the guard clause protects against a future
 * refactor calling it early.
 */
export function toAssessment(draft: JourneyDraft): Assessment {
  if (
    draft.monthlyIncome === null ||
    draft.propertyPrice === null ||
    draft.expectedStay === null ||
    draft.moveLikelihood === null
  ) {
    throw new Error('Assessment is incomplete');
  }

  return {
    id: generateAssessmentId(),
    createdAt: new Date().toISOString(),
    monthlyIncome: draft.monthlyIncome,
    essentialExpenses: draft.essentialExpenses ?? 0,
    existingDebtRepayments: draft.existingDebtRepayments ?? 0,
    accessibleSavings: draft.accessibleSavings ?? 0,
    currentRent: draft.currentRent ?? 0,
    propertyPrice: draft.propertyPrice,
    upfrontContribution: draft.upfrontContribution ?? 0,
    // null is meaningful: it tells the engine to substitute and label a default.
    interestRate: draft.rateUnknown ? null : draft.interestRate,
    loanTermYears: draft.loanTermYears,
    expectedStay: draft.expectedStay,
    moveLikelihood: draft.moveLikelihood,
    flexibilityImportance: draft.flexibilityImportance,
    ownershipImportance: draft.ownershipImportance,
    riskTolerance: draft.riskTolerance,
    priorities: draft.priorities,
  };
}

/**
 * Non-identifying reference for the assessment.
 *
 * Deliberately random rather than derived from the customer's answers - see
 * docs/data-model.md on why we collect no personal identifiers at all.
 */
function generateAssessmentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
