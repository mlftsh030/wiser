import type { ScenarioResult } from '../../models/results';
import { formatCurrency } from '../../utils/format';

/**
 * The scenario range.
 *
 * A deliberately plain visual: three labelled points, each stating which way it
 * leans in words. The value is in seeing whether the answer holds - not in the
 * chart itself.
 */
export function ScenarioRange({ scenarios }: { scenarios: ScenarioResult[] }) {
  const verdict = (favours: string): { text: string; tone: string } =>
    favours === 'buy'
      ? { text: 'Buying stronger', tone: 'positive' }
      : favours === 'rent'
        ? { text: 'Renting stronger', tone: 'warning' }
        : { text: 'Close to even', tone: 'caution' };

  return (
    <div className="scenarios">
      {scenarios.map((scenario) => {
        const { text, tone } = verdict(scenario.outcome.favours);
        return (
          <div key={scenario.name} className={`scenario scenario--${tone}`}>
            <div className="scenario__label">{scenario.label}</div>
            <div className="scenario__verdict">{text}</div>
            <div className="scenario__detail">
              {scenario.outcome.netAdvantageOfBuying >= 0 ? 'Buying ahead by ' : 'Renting ahead by '}
              {formatCurrency(Math.abs(scenario.outcome.netAdvantageOfBuying))}
            </div>
            <p className="scenario__description">{scenario.description}</p>
          </div>
        );
      })}
    </div>
  );
}
