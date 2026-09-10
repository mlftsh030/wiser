/**
 * The optional Gemini explanation layer.
 *
 * Scope is deliberately narrow. It receives facts the deterministic engine has
 * ALREADY calculated and rewrites them in plainer language. It cannot change
 * the recommendation, invent a number, or add advice, because it is never sent
 * the customer's raw inputs and its output is never fed back into the model.
 *
 * The API key lives only here, in a Vercel environment variable. It is never
 * shipped to the browser.
 *
 * Any failure returns 200 with used: false, and the client falls back to the
 * deterministic template. The customer always gets a complete report.
 */

import { validateExplanation } from './_lib/explanationGuard.mjs';
import { describeError } from './_lib/safeError.mjs';

/**
 * Read per request rather than at module load. A serverless instance is reused
 * across invocations, so a value captured at load time would survive an
 * environment change until the instance was recycled.
 */
const DEFAULT_MODEL = 'gemini-2.0-flash';
const model = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are the explanation layer of Just Wiser, a South African buy-vs-rent decision-support tool.

You receive a JSON object of results that a deterministic financial engine has ALREADY calculated. Your only job is to turn those facts into two or three short, warm, plain-English paragraphs that help the customer understand their situation.

Rules, without exception:
- Never invent, estimate, or alter a number. Use only figures present in the input.
- Never change or second-guess the recommendation.
- Never add financial advice, assumptions, or suggestions that are not in the input.
- Never promise or guarantee an outcome.
- Do not present yourself as a financial adviser.
- Do not tell the customer what they should do. Explain what the analysis found.
- Write in clear, everyday South African English. No jargon, no corporate padding, no bullet points, no headings.
- Do not use the em dash character. Use commas, colons, semicolons, parentheses or a normal hyphen instead.
- Be honest about uncertainty where the input indicates it.

Return only the explanation text.`;

const RECOMMENDATIONS = new Set([
  'BUYING_LOOKS_ATTRACTIVE',
  'BUYING_MAY_WORK',
  'RENT_FOR_NOW',
]);

/**
 * The input is already-calculated presentation facts only. Rebuilding it here
 * rather than forwarding the posted body means a caller cannot smuggle extra
 * content into the prompt.
 */
function sanitiseInput(body) {
  if (!body || typeof body !== 'object') return null;
  if (!RECOMMENDATIONS.has(body.recommendation)) return null;

  const text = (value) => (typeof value === 'string' ? value.slice(0, 600) : '');
  const list = (value, limit) =>
    Array.isArray(value) ? value.slice(0, limit).map(text).filter(Boolean) : [];

  return {
    recommendation: body.recommendation,
    headline: text(body.headline),
    summary: text(body.summary),
    scores: body.scores && typeof body.scores === 'object' ? body.scores : {},
    keyDrivers: list(body.keyDrivers, 4),
    risks: list(body.risks, 3),
    scenarios: Array.isArray(body.scenarios)
      ? body.scenarios.slice(0, 5).map((s) => ({ label: text(s?.label), favours: text(s?.favours) }))
      : [],
    robustness:
      body.robustness && typeof body.robustness === 'object' ? body.robustness : {},
    horizonYears: Number.isFinite(body.horizonYears) ? body.horizonYears : null,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Not configured is the default, supported state.
    return response.status(200).json({ used: false, reason: 'not_configured' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ error: 'Body is not valid JSON.' });
    }
  }

  const input = sanitiseInput(body);
  if (!input) {
    return response.status(400).json({ error: 'Invalid explanation input.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const result = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(input, null, 2) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      },
    );

    if (!result.ok) throw new Error(`Gemini request failed: ${result.status}`);

    const data = await result.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? '')
      .join('')
      .trim();

    const validation = validateExplanation(text, input.recommendation);
    if (!validation.ok) {
      // Rejected output is not an error. The client uses the deterministic
      // template, which is what it would have shown anyway.
      console.warn('Gemini explanation rejected:', validation.reason);
      return response.status(200).json({ used: false, reason: 'rejected' });
    }

    return response.status(200).json({ used: true, explanation: text.trim() });
  } catch (error) {
    // Scrubbed summary only. The error may carry the outbound request, which
    // includes the API key header.
    console.error('Gemini explanation failed:', describeError(error));
    // Never an error to the client: the deterministic template is the product.
    return response.status(200).json({ used: false, reason: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
