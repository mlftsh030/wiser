import type { ExplanationInput, ExplanationService } from './types';

/**
 * The default narrative. Entirely deterministic, so the product is fully
 * useful with no API key, no network and no cost. The AI service, when
 * enabled, only rephrases what this already says.
 */
export class TemplateExplanationService implements ExplanationService {
  readonly source = 'template' as const;

  async explain(input: ExplanationInput): Promise<string> {
    const parts: string[] = [input.summary];

    if (input.keyDrivers.length > 0) {
      parts.push(`The main thing driving this is straightforward. ${input.keyDrivers[0]}`);
    }

    if (input.risks.length > 0) {
      parts.push(`It is worth being clear about the trade-off, though. ${input.risks[0]}`);
    }

    parts.push(this.describeRobustness(input));

    return parts.join('\n\n');
  }

  private describeRobustness(input: ExplanationInput): string {
    const { supporting, total, sensitive } = input.robustness;

    if (sensitive) {
      return `We tested this against ${total} different views of the future, and ${supporting} of them point the same way. The others do not, which tells you this result leans on assumptions about the property market that nobody can guarantee. Treat it as a considered starting point rather than a settled answer.`;
    }

    return `We tested this against ${total} different views of the future and all ${supporting} point the same way, so the result does not hinge on one optimistic assumption.`;
  }
}
