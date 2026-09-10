import { CurrencyInput } from '../components/inputs';
import type { JourneyDraft } from '../hooks/useAssessmentJourney';
import { formatCurrency } from '../utils/format';
import type { ValidationErrors } from '../utils/validation';

export function HomePage({
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
        <h1>Now, the home itself.</h1>
        <p>
          We need what you pay now and what you are considering buying, so we have two real
          options to compare rather than an abstract one.
        </p>
      </header>

      <CurrencyInput
        label="Current monthly rent"
        why="This is the alternative we compare buying against. If you do not pay rent at the moment, enter 0 and we will compare against your current arrangement costing nothing."
        value={draft.currentRent}
        onChange={(value) => update('currentRent', value)}
        error={errors.currentRent}
        placeholder="12 000"
      />

      <CurrencyInput
        label="Property price you're considering"
        why="This allows us to estimate the financing and ongoing costs of ownership. A rough figure for the kind of home you have in mind is fine."
        value={draft.propertyPrice}
        onChange={(value) => update('propertyPrice', value)}
        error={errors.propertyPrice}
        placeholder="1 800 000"
      />

      <CurrencyInput
        label="Amount you're comfortable putting towards the purchase"
        why="We don't want to assume that every rand you have should go into the house. Keeping accessible savings can be important, so tell us what you would actually be comfortable committing."
        value={draft.upfrontContribution}
        onChange={(value) => update('upfrontContribution', value)}
        error={errors.upfrontContribution}
        placeholder="200 000"
      />

      {draft.accessibleSavings !== null && draft.upfrontContribution !== null && !errors.upfrontContribution ? (
        <div className="inline-note" role="status">
          <p>
            That would leave {formatCurrency(draft.accessibleSavings - draft.upfrontContribution)}{' '}
            of your savings untouched, before the costs of buying. We will come back to whether
            that is enough.
          </p>
        </div>
      ) : null}
    </div>
  );
}
