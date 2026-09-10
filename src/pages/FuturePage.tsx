import { ChoiceGroup } from '../components/inputs';
import type { JourneyDraft } from '../hooks/useAssessmentJourney';
import type { ExpectedStay, MoveLikelihood } from '../models/assessment';

const STAY_OPTIONS: { value: ExpectedStay; label: string; hint?: string }[] = [
  { value: 'under_3', label: 'Less than 3 years' },
  { value: '3_to_5', label: '3 to 5 years' },
  { value: '5_to_10', label: '5 to 10 years' },
  { value: 'over_10', label: 'More than 10 years' },
  { value: 'unsure', label: "I'm not sure", hint: 'We will assume five years and tell you where that matters' },
];

const MOVE_OPTIONS: { value: MoveLikelihood; label: string }[] = [
  { value: 'very_unlikely', label: 'Very unlikely' },
  { value: 'unlikely', label: 'Unlikely' },
  { value: 'unsure', label: 'Not sure' },
  { value: 'likely', label: 'Likely' },
  { value: 'very_likely', label: 'Very likely' },
];

export function FuturePage({
  draft,
  update,
  errors,
}: {
  draft: JourneyDraft;
  update: <K extends keyof JourneyDraft>(key: K, value: JourneyDraft[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="step-enter">
      <header className="step-head">
        <h1>How long do you see yourself there?</h1>
        <p>
          Buying and selling a property involves costs, so how long you expect to stay can
          materially affect the comparison. This is often the single most decisive answer.
        </p>
      </header>

      <ChoiceGroup
        legend="How long do you expect to live in this property?"
        why="Transfer duty, attorney fees and agent commission are paid once but recovered slowly. A short stay rarely gives the property time to grow past those costs."
        options={STAY_OPTIONS}
        value={draft.expectedStay}
        onChange={(value) => update('expectedStay', value)}
        error={errors.expectedStay}
      />

      <ChoiceGroup
        legend="How likely are you to move within the next five years?"
        why="Plans change - a new job, a relationship, a family. We ask separately because how confident you are matters as much as the number of years."
        options={MOVE_OPTIONS}
        value={draft.moveLikelihood}
        onChange={(value) => update('moveLikelihood', value)}
        error={errors.moveLikelihood}
      />
    </div>
  );
}
