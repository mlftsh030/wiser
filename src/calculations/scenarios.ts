/**
 * Scenario analysis.
 *
 * A single projection implies a precision we do not have. Property growth,
 * rental growth and investment returns are the assumptions the answer is most
 * sensitive to, so we vary those three together and show the customer the
 * range. If the answer flips between scenarios, that is the most important
 * thing we can tell them.
 *
 * "Conservative" and "optimistic" are framed from the buyer's point of view:
 * conservative = weaker property growth, stronger alternative returns.
 *
 * Adding a scenario is a matter of appending to SCENARIOS - the engine, the
 * robustness calculation and the UI all derive from this list.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import type { ScenarioName, ScenarioResult } from '../models/results';
import { compareBuyVsRent, type ComparisonInput } from './comparison';

export interface ScenarioDefinition {
  name: ScenarioName;
  label: string;
  description: string;
  /** Adjustments in percentage points, applied to the base assumptions. */
  adjust: {
    propertyGrowth: number;
    rentalGrowth: number;
    investmentReturn: number;
  };
}

export const SCENARIOS: ReadonlyArray<ScenarioDefinition> = [
  {
    name: 'conservative',
    label: 'Conservative',
    description:
      'Property grows more slowly than expected, and money invested elsewhere does better.',
    adjust: { propertyGrowth: -0.02, rentalGrowth: -0.01, investmentReturn: +0.02 },
  },
  {
    name: 'base',
    label: 'Base',
    description: 'Our central assumptions, broadly in line with long-run averages.',
    adjust: { propertyGrowth: 0, rentalGrowth: 0, investmentReturn: 0 },
  },
  {
    name: 'optimistic',
    label: 'Optimistic',
    description:
      'Property grows faster, rents rise faster, and other investments do less well.',
    adjust: { propertyGrowth: +0.02, rentalGrowth: +0.01, investmentReturn: -0.02 },
  },
];

/** Apply a scenario's adjustments, flooring rates so they cannot go negative. */
export function applyScenario(
  base: Assumptions,
  definition: ScenarioDefinition,
): Assumptions {
  const { adjust } = definition;
  return {
    ...base,
    rates: {
      ...base.rates,
      propertyGrowth: Math.max(base.rates.propertyGrowth + adjust.propertyGrowth, 0),
      rentalGrowth: Math.max(base.rates.rentalGrowth + adjust.rentalGrowth, 0),
      investmentReturn: Math.max(base.rates.investmentReturn + adjust.investmentReturn, 0),
    },
  };
}

export function runScenarios(
  input: ComparisonInput,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): ScenarioResult[] {
  return SCENARIOS.map((definition) => ({
    name: definition.name,
    label: definition.label,
    description: definition.description,
    outcome: compareBuyVsRent(input, applyScenario(assumptions, definition)),
  }));
}
