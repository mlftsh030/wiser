import { CurrencyInput } from '../components/inputs';
import type { JourneyDraft } from '../hooks/useAssessmentJourney';
import type { ValidationErrors } from '../utils/validation';

export function SituationPage({
  draft,
  update,
  errors,
}: {
  draft: JourneyDraft;
  update: <K extends keyof JourneyDraft>(key: K, value: JourneyDraft[K]) => void;
  errors: ValidationErrors;
}) {
  return (
    <div className="step-enter">
      <header className="step-head">
        <h1>Let's start with where you are today.</h1>
        <p>
          Before comparing buying and renting, we need to understand what your current financial
          position looks like.
        </p>
      </header>

      <CurrencyInput
        label="Monthly take-home household income"
        why="We use your income to understand what housing costs your current finances could support. Use what actually lands in your account, after tax and deductions."
        value={draft.monthlyIncome}
        onChange={(value) => update('monthlyIncome', value)}
        error={errors.monthlyIncome}
        placeholder="45 000"
      />

      <CurrencyInput
        label="Essential monthly expenses"
        why="This helps us understand what income is already committed before adding a housing payment. Think food, transport, school fees, insurance and utilities - not rent."
        value={draft.essentialExpenses}
        onChange={(value) => update('essentialExpenses', value)}
        error={errors.essentialExpenses}
        placeholder="15 000"
      />

      <CurrencyInput
        label="Existing monthly debt repayments"
        why="Existing debt affects how much room you have for another long-term commitment. Include car finance, personal loans, credit cards and store accounts."
        value={draft.existingDebtRepayments}
        onChange={(value) => update('existingDebtRepayments', value)}
        error={errors.existingDebtRepayments}
        placeholder="4 000"
      />

      <CurrencyInput
        label="Accessible savings"
        why="Buying a home requires more than a deposit. We also need to understand how much financial buffer you would have afterwards. Include only money you could actually reach within a few days."
        value={draft.accessibleSavings}
        onChange={(value) => update('accessibleSavings', value)}
        error={errors.accessibleSavings}
        placeholder="250 000"
      />

      {errors._warning ? (
        <div className="inline-note inline-note--caution" role="status">
          <strong>Worth a look</strong>
          <p>{errors._warning}</p>
        </div>
      ) : null}
    </div>
  );
}
