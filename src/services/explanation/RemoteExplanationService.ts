/**
 * Client for the optional AI explanation layer.
 *
 * It calls our own serverless function, never a model provider directly. The
 * browser therefore holds no API key, and the decision about whether AI is
 * available at all is made on the server.
 *
 * The contract is deliberately forgiving: the function answers 200 with
 * used: false whenever it cannot help (not configured, unavailable, or output
 * that failed validation), and this class quietly falls back to the template.
 * A customer never learns that an AI call was attempted.
 */

import { TemplateExplanationService } from './TemplateExplanationService';
import { validateExplanation } from './guard';
import type { ExplanationInput, ExplanationService } from './types';

const ENDPOINT = '/api/explain';
const TIMEOUT_MS = 9000;

export class RemoteExplanationService implements ExplanationService {
  /**
   * Reported as 'ai' only when the narrative actually came from the model.
   * buildReport reads this after explain() resolves, so the report records
   * what the customer really saw.
   */
  source: 'template' | 'ai' = 'template';

  private readonly fallback = new TemplateExplanationService();

  private readonly endpoint: string;

  constructor(endpoint: string = ENDPOINT) {
    this.endpoint = endpoint;
  }

  async explain(input: ExplanationInput): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error(`Explanation request failed: ${response.status}`);

      const data = await response.json();

      if (data?.used === true) {
        // Checked again here, even though the function already checked. The
        // narrative is the one thing a customer reads as prose, so nothing
        // reaches them unvalidated regardless of what answered the request.
        const validation = validateExplanation(data.explanation, input.recommendation);
        if (validation.ok) {
          this.source = 'ai';
          return String(data.explanation).trim();
        }
        console.warn('Explanation rejected by the client guard:', validation.reason);
      }

      this.source = 'template';
      return this.fallback.explain(input);
    } catch {
      // The narrative is a nicety. The deterministic report is the product.
      this.source = 'template';
      return this.fallback.explain(input);
    } finally {
      clearTimeout(timer);
    }
  }
}
