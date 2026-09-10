import { MultiChoiceGroup, ScaleInput } from '../components/inputs';
import type { JourneyDraft } from '../hooks/useAssessmentJourney';
import type { Priority, Rating } from '../models/assessment';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low_monthly_costs', label: 'Keep monthly costs low' },
  { value: 'build_wealth', label: 'Build long-term wealth' },
  { value: 'flexibility', label: 'Keep flexibility' },
  { value: 'stable_housing', label: 'Stable housing' },
  { value: 'own_asset', label: 'Own an asset' },
  { value: 'keep_savings', label: 'Keep savings available' },
  { value: 'avoid_debt', label: 'Avoid taking on more debt' },
];

export function PrioritiesPage({
  draft,
  update,
}: {
  draft: JourneyDraft;
  update: <K extends keyof JourneyDraft>(key: K, value: JourneyDraft[K]) => void;
}) {
  return (
    <div className="step-enter">
      <header className="step-head">
        <h1>What matters to you?</h1>
        <p>
          There isn't one financially correct answer for everyone. These questions help us
          understand what the decision means to you.
        </p>
      </header>

      <ScaleInput
        label="How important is flexibility to you?"
        why="Being able to move at short notice has real value, and it is the thing owning a home takes away."
        value={draft.flexibilityImportance}
        onChange={(value) => update('flexibilityImportance', value as Rating)}
        lowLabel="Not important"
        highLabel="Very important"
      />

      <ScaleInput
        label="How important is owning your home?"
        why="For many people this matters beyond the money - security, permanence, or something to pass on. That is a legitimate part of the decision."
        value={draft.ownershipImportance}
        onChange={(value) => update('ownershipImportance', value as Rating)}
        lowLabel="Not important"
        highLabel="Very important"
      />

      <ScaleInput
        label="How comfortable are you with financial uncertainty?"
        why="Interest rates move and property values are not guaranteed. Some people sleep fine through that; others do not, and that is worth knowing about yourself."
        value={draft.riskTolerance}
        onChange={(value) => update('riskTolerance', value as Rating)}
        lowLabel="Not comfortable"
        highLabel="Very comfortable"
      />

      <MultiChoiceGroup
        legend="What matters most to you?"
        why="Choose as many as apply. We use these to check whether the financial answer actually fits what you are trying to achieve."
        options={PRIORITIES}
        values={draft.priorities}
        onChange={(values) => update('priorities', values)}
      />
    </div>
  );
}
