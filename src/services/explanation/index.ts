import { RemoteExplanationService } from './RemoteExplanationService';
import { TemplateExplanationService } from './TemplateExplanationService';
import type { ExplanationService } from './types';

/**
 * Chooses an implementation at runtime.
 *
 * The browser cannot know whether an AI key is configured, because the key is
 * server-side and must stay there. So it always asks the function, and the
 * function decides. When AI is switched off the function says so immediately
 * and the remote service falls back to the template, which is why a deployment
 * with no key configured behaves exactly like the default product.
 *
 * VITE_DISABLE_AI=true skips the request entirely, which is useful for a
 * purely offline demo.
 */
export function createExplanationService(): ExplanationService {
  if (import.meta.env?.VITE_DISABLE_AI === 'true') {
    return new TemplateExplanationService();
  }
  return new RemoteExplanationService();
}

export { RemoteExplanationService, TemplateExplanationService };
export type { ExplanationService } from './types';
export { buildExplanationInput } from './types';
