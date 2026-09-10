import { ChoiceGroup, PercentInput } from '../components/inputs';
import { DEFAULT_ASSUMPTIONS } from '../config/assumptions';
import type { JourneyDraft } from '../hooks/useAssessmentJourney';
import { formatPercent } from '../utils/format';
import type { ValidationErrors } from '../utils/validation';

const TERMS = [
  { value: '10', label: '10 years', hint: 'Highest monthly payment, least interest overall' },
  { value: '15', label: '15 years' },
  { value: '20', label: '20 years', hint: 'The most common choice in South Africa' },
  { value: '25', label: '25 years' },
  { value: '30', label: '30 years', hint: 'Lowest monthly payment, most interest overall' },
];

export function FinancingPage({
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
        <h1>How would you finance it?</h1>
        <p>
          The rate and the term change the monthly payment substantially, and they are two of the
          few things in this decision you can actually negotiate.
        </p>
      </header>

      <PercentInput
        label="Expected interest rate"
        why="If a bank has quoted you a rate, use it. Rates are usually expressed relative to prime, and a small difference adds up over twenty years."
        value={draft.interestRate}
        onChange={(value) => update('interestRate', value)}
        error={errors.interestRate}
        disabled={draft.rateUnknown}
      />

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.rateUnknown}
          onChange={(event) => {
            update('rateUnknown', event.target.checked);
            if (event.target.checked) update('interestRate', null);
          }}
        />
        <span>I don't know what rate I would get</span>
      </label>

      {draft.rateUnknown ? (
        <div className="inline-note inline-note--caution" role="status">
          <strong>We are using an assumption because you don't have an estimated rate.</strong>
          <p>
            We will model {formatPercent(DEFAULT_ASSUMPTIONS.rates.defaultInterestRate, 2)}, roughly
            the prevailing prime rate. Your actual rate depends on your credit profile and your
            deposit, and we will show you how much a one percentage point difference matters.
          </p>
        </div>
      ) : null}

      <ChoiceGroup
        legend="Loan term"
        why="A longer term can reduce the monthly payment but increase total interest paid. There is no single right answer - it is a trade-off between monthly comfort and lifetime cost."
        options={TERMS}
        value={String(draft.loanTermYears)}
        onChange={(value) => update('loanTermYears', Number(value))}
        error={errors.loanTermYears}
        columns={2}
      />
    </div>
  );
}
