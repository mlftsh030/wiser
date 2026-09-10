/**
 * Column order and validation for the internal assessment record.
 *
 * This mirrors EXPORT_COLUMNS in src/services/storage/recordMapper.ts. It is
 * repeated as a plain list rather than imported because Vercel functions run
 * as standalone Node modules with no build step over src/.
 *
 * If you add a column in one place, add it in the other. The contract test in
 * src/services/__tests__/persistence.test.ts fails when the two drift apart,
 * so this cannot silently rot.
 */

export const COLUMNS = [
  ['assessment_id', 'Assessment ID'],
  ['timestamp', 'Timestamp'],
  ['income', 'Monthly income'],
  ['essential_expenses', 'Essential expenses'],
  ['existing_debt', 'Existing debt repayments'],
  ['savings', 'Accessible savings'],
  ['current_rent', 'Current rent'],
  ['property_price', 'Property price'],
  ['upfront_contribution', 'Upfront contribution'],
  ['interest_rate', 'Interest rate'],
  ['interest_rate_assumed', 'Rate assumed?'],
  ['loan_term', 'Loan term (years)'],
  ['expected_stay', 'Expected stay'],
  ['move_likelihood', 'Move likelihood'],
  ['flexibility', 'Flexibility (1-5)'],
  ['ownership_preference', 'Ownership importance (1-5)'],
  ['risk_tolerance', 'Risk tolerance (1-5)'],
  ['primary_priority', 'Priorities'],
  ['monthly_bond', 'Monthly bond'],
  ['monthly_ownership_cost', 'Monthly ownership cost'],
  ['monthly_surplus', 'Monthly surplus after housing'],
  ['upfront_costs', 'Estimated upfront costs'],
  ['remaining_savings', 'Savings remaining'],
  ['emergency_buffer_months', 'Buffer (months)'],
  ['projected_rent_cost', 'Projected rent paid'],
  ['projected_buying_cost', 'Projected cost of owning'],
  ['projected_equity', 'Projected equity on sale'],
  ['net_advantage_of_buying', 'Net advantage of buying'],
  ['conservative_net_advantage', 'Conservative: net advantage'],
  ['conservative_favours', 'Conservative: favours'],
  ['base_net_advantage', 'Base: net advantage'],
  ['base_favours', 'Base: favours'],
  ['optimistic_net_advantage', 'Optimistic: net advantage'],
  ['optimistic_favours', 'Optimistic: favours'],
  ['financial_score', 'Financial position score'],
  ['resilience_score', 'Resilience score'],
  ['financial_outcome_score', 'Financial outcome score'],
  ['personal_fit_score', 'Personal fit score'],
  ['recommendation', 'Recommendation'],
  ['recommendation_robustness', 'Robustness'],
  ['scenario_sensitive', 'Sensitive to assumptions?'],
  ['primary_reason', 'Primary reason'],
  ['primary_risk', 'Primary risk'],
];

export const HEADERS = COLUMNS.map(([, header]) => header);
export const KEYS = COLUMNS.map(([key]) => key);

const RECOMMENDATIONS = new Set([
  'BUYING_LOOKS_ATTRACTIVE',
  'BUYING_MAY_WORK',
  'RENT_FOR_NOW',
]);

/**
 * Field names we refuse to store, checked on the way in.
 *
 * The client never sends these, so this is a second line of defence rather
 * than the first: it means a future change to the client cannot quietly start
 * writing personal information into the sheet.
 */
const FORBIDDEN_FRAGMENTS = [
  'name',
  'surname',
  'email',
  'phone',
  'mobile',
  'cell',
  'address',
  'id_number',
  'idnumber',
  'passport',
  'birth',
  'dob',
  'employer',
  'bank',
  'account_number',
  'card',
];

/** Longest string we will store in a single cell. */
const MAX_TEXT_LENGTH = 1000;

/**
 * Validates the posted record before it reaches the spreadsheet.
 *
 * Returns { ok: true, row } or { ok: false, error }. Rejecting bad data here
 * keeps the sheet analysable and stops an unexpected payload from being
 * written verbatim.
 */
export function validateRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a JSON object.' };
  }

  const unexpected = Object.keys(body).filter((key) => !KEYS.includes(key));
  if (unexpected.length > 0) {
    return { ok: false, error: `Unexpected field(s): ${unexpected.join(', ')}` };
  }

  const offending = Object.keys(body).filter((key) => {
    const lower = key.toLowerCase();
    return FORBIDDEN_FRAGMENTS.some((fragment) => lower.includes(fragment));
  });
  if (offending.length > 0) {
    return { ok: false, error: 'Record contains fields that look like personal information.' };
  }

  if (typeof body.assessment_id !== 'string' || !/^[A-Z0-9-]{4,64}$/.test(body.assessment_id)) {
    return { ok: false, error: 'Invalid assessment_id.' };
  }
  if (typeof body.timestamp !== 'string' || Number.isNaN(Date.parse(body.timestamp))) {
    return { ok: false, error: 'Invalid timestamp.' };
  }
  if (!RECOMMENDATIONS.has(body.recommendation)) {
    return { ok: false, error: 'Invalid recommendation.' };
  }

  const row = [];
  for (const key of KEYS) {
    const value = body[key];

    if (value === undefined || value === null) {
      row.push('');
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return { ok: false, error: `Field ${key} is not a finite number.` };
      }
      row.push(value);
      continue;
    }
    if (typeof value === 'boolean') {
      row.push(value ? 'TRUE' : 'FALSE');
      continue;
    }
    if (typeof value === 'string') {
      // A leading =, + or @ would be read as a formula by a spreadsheet, so
      // prefix it. This is the standard CSV injection guard.
      const trimmed = value.slice(0, MAX_TEXT_LENGTH);
      row.push(/^[=+@-]/.test(trimmed) ? `'${trimmed}` : trimmed);
      continue;
    }
    return { ok: false, error: `Field ${key} has an unsupported type.` };
  }

  return { ok: true, row };
}
