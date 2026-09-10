/**
 * Builds the structure of the customer's PDF report.
 *
 * Deliberately pure: it takes a finished ReportModel and returns a plain
 * document description. No pdf-lib, no DOM, no I/O. Two things follow from
 * that. The content can be asserted in tests without rendering anything, and
 * the renderer stays a dumb layout engine that cannot introduce a number of
 * its own.
 *
 * Every value here is read from the ReportModel. Nothing is recalculated, so
 * the PDF cannot disagree with the screen.
 */

import { ASSUMPTION_NOTES, DEFAULT_ASSUMPTIONS } from '../../config/assumptions';
import { EXPECTED_STAY_YEARS } from '../../models/assessment';
import type { ReportModel } from '../../models/results';
import { formatCurrency, formatMonths, formatPercent } from '../../utils/format';

/** A label/value pair, as shown in the two-column blocks of the report. */
export interface DocumentField {
  label: string;
  value: string;
  /** Optional clarification printed under the value in smaller type. */
  note?: string;
}

export type DocumentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'fields'; fields: DocumentField[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'callout'; title: string; text: string };

export interface DocumentSection {
  title: string;
  /** Printed under the heading to explain what the section is for. */
  lede?: string;
  blocks: DocumentBlock[];
}

export interface ReportDocument {
  title: string;
  tagline: string;
  reference: string;
  generatedAt: string;
  headline: string;
  recommendation: string;
  sections: DocumentSection[];
  disclaimer: string;
}

const STAY_LABELS: Record<string, string> = {
  under_3: 'Less than 3 years',
  '3_to_5': '3 to 5 years',
  '5_to_10': '5 to 10 years',
  over_10: 'More than 10 years',
  unsure: 'Not sure yet',
};

const MOVE_LABELS: Record<string, string> = {
  very_unlikely: 'Very unlikely',
  unlikely: 'Unlikely',
  unsure: 'Unsure',
  likely: 'Likely',
  very_likely: 'Very likely',
};

const PRIORITY_LABELS: Record<string, string> = {
  low_monthly_costs: 'Low monthly costs',
  build_wealth: 'Building wealth',
  flexibility: 'Flexibility',
  stable_housing: 'Stable housing',
  own_asset: 'Owning an asset',
  keep_savings: 'Keeping savings accessible',
  avoid_debt: 'Avoiding debt',
};

const FAVOURS_LABELS: Record<string, string> = {
  buy: 'Buying ahead',
  rent: 'Renting ahead',
  neutral: 'Too close to call',
};

const RESILIENCE_LABELS: Record<string, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  limited: 'Limited',
  very_limited: 'Very limited',
};

const rating = (value: number): string => `${value} out of 5`;
const score = (value: number): string => `${(Math.round(value * 10) / 10).toFixed(1)} / 10`;

/** Formats the ISO timestamp for a South African reader. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} at ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function buildReportDocument(report: ReportModel): ReportDocument {
  const { assessment, metrics, decision } = report;
  const { position, resilience, ownershipCosts, mortgage, transactionCosts, baseOutcome } = metrics;

  const horizonNote = metrics.horizonAssumed
    ? `We assumed ${metrics.horizonYears} years because you were not sure how long you would stay.`
    : `Based on the ${metrics.horizonYears} years you expect to stay.`;

  return {
    title: 'Just Wiser',
    tagline: 'Driven by better financial decisions.',
    reference: assessment.id,
    generatedAt: formatTimestamp(assessment.createdAt),
    headline: decision.headline,
    recommendation: decision.recommendation,
    disclaimer: DISCLAIMER,
    sections: [
      {
        title: 'What this report is',
        blocks: [
          {
            kind: 'paragraph',
            text: 'This report compares buying and renting for the situation you described. It is decision support, not a verdict: it sets out what the numbers say, why the model reached its recommendation, how sensitive that recommendation is to a different future, and what could change it.',
          },
          {
            kind: 'paragraph',
            text: 'Everything here is calculated from the information you entered and the assumptions listed near the end. If an assumption does not match your situation, the result may well change.',
          },
        ],
      },
      {
        title: 'Recommendation',
        blocks: [
          { kind: 'callout', title: decision.headline, text: decision.summary },
          // The template explanation opens with the summary, which is already
          // in the callout above. Dropping the repeat keeps the page readable
          // without losing anything the customer has not already read.
          ...(report.explanation.trim().startsWith(decision.summary.trim())
            ? [
                {
                  kind: 'paragraph' as const,
                  text: report.explanation.slice(decision.summary.length).trim(),
                },
              ]
            : [{ kind: 'paragraph' as const, text: report.explanation }]),
          {
            kind: 'fields',
            fields: [
              {
                label: 'Scenarios supporting this result',
                value: `${decision.robustness.supporting} of ${decision.robustness.total}`,
              },
              {
                label: 'Sensitive to our assumptions',
                value: decision.robustness.sensitive ? 'Yes' : 'No',
                note: decision.robustness.sensitive
                  ? 'The scenarios disagree about the direction of the answer, so treat this result as finely balanced.'
                  : 'The scenarios point the same way, so the result is reasonably stable across the futures we tested.',
              },
            ],
          },
        ],
      },
      {
        title: 'Your financial information',
        lede: 'The figures you entered. These are the inputs to every calculation that follows.',
        blocks: [
          {
            kind: 'fields',
            fields: [
              { label: 'Monthly take-home income', value: formatCurrency(assessment.monthlyIncome) },
              { label: 'Essential monthly expenses', value: formatCurrency(assessment.essentialExpenses) },
              { label: 'Existing debt repayments', value: formatCurrency(assessment.existingDebtRepayments) },
              { label: 'Accessible savings', value: formatCurrency(assessment.accessibleSavings) },
            ],
          },
        ],
      },
      {
        title: 'The home and the financing',
        blocks: [
          {
            kind: 'fields',
            fields: [
              { label: 'Property price', value: formatCurrency(assessment.propertyPrice) },
              { label: 'Current or comparable rent', value: formatCurrency(assessment.currentRent) },
              { label: 'Deposit or upfront contribution', value: formatCurrency(assessment.upfrontContribution) },
              { label: 'Loan amount', value: formatCurrency(mortgage.loanAmount) },
              {
                label: 'Interest rate',
                value: formatPercent(mortgage.annualRate),
                note: mortgage.usedDefaultRate
                  ? 'You told us you did not know your rate, so we used our default assumption.'
                  : 'As you entered it.',
              },
              { label: 'Loan term', value: `${assessment.loanTermYears} years` },
            ],
          },
        ],
      },
      {
        title: 'Your circumstances and preferences',
        lede: 'These do not override the numbers, but they shape which option fits your life.',
        blocks: [
          {
            kind: 'fields',
            fields: [
              {
                label: 'How long you expect to stay',
                value: STAY_LABELS[assessment.expectedStay] ?? assessment.expectedStay,
                note: `Modelled over ${EXPECTED_STAY_YEARS[assessment.expectedStay]} years.`,
              },
              {
                label: 'Likelihood of moving within five years',
                value: MOVE_LABELS[assessment.moveLikelihood] ?? assessment.moveLikelihood,
              },
              { label: 'Importance of flexibility', value: rating(assessment.flexibilityImportance) },
              { label: 'Importance of owning', value: rating(assessment.ownershipImportance) },
              { label: 'Comfort with financial risk', value: rating(assessment.riskTolerance) },
              {
                label: 'What matters most to you',
                value:
                  assessment.priorities.length > 0
                    ? assessment.priorities.map((p) => PRIORITY_LABELS[p] ?? p).join(', ')
                    : 'Nothing selected',
              },
            ],
          },
        ],
      },
      {
        title: 'Monthly affordability',
        lede: 'What owning this home would cost every month, and what it would leave you with.',
        blocks: [
          {
            kind: 'fields',
            fields: [
              { label: 'Bond repayment', value: formatCurrency(ownershipCosts.mortgage) },
              { label: 'Rates and taxes', value: formatCurrency(ownershipCosts.ratesAndTaxes) },
              { label: 'Building insurance', value: formatCurrency(ownershipCosts.insurance) },
              { label: 'Maintenance allowance', value: formatCurrency(ownershipCosts.maintenance) },
              { label: 'Levies', value: formatCurrency(ownershipCosts.levies) },
              {
                label: 'Full monthly cost of owning',
                value: formatCurrency(ownershipCosts.total),
                note: 'This is the number to compare with your rent, not the bond repayment alone.',
              },
              {
                label: 'Share of your take-home income',
                value: formatPercent(position.housingCostRatio),
              },
              {
                label: 'Left over each month if you buy',
                value: formatCurrency(position.monthlySurplusAfterHousing),
                note: 'After essentials, debt repayments and the full cost of owning.',
              },
              {
                label: 'Left over each month if you keep renting',
                value: formatCurrency(position.monthlySurplusIfRenting),
              },
            ],
          },
        ],
      },
      {
        title: 'Upfront cost and your safety net',
        lede: 'Buying takes cash out of your savings on day one. This is what would be left.',
        blocks: [
          {
            kind: 'fields',
            fields: [
              { label: 'Transfer duty', value: formatCurrency(transactionCosts.transferDuty) },
              { label: 'Conveyancing and transfer fees', value: formatCurrency(transactionCosts.conveyancing) },
              { label: 'Bond registration', value: formatCurrency(transactionCosts.bondRegistration) },
              { label: 'Deeds Office and sundries', value: formatCurrency(transactionCosts.deedsOffice + transactionCosts.sundries) },
              { label: 'Total purchase costs', value: formatCurrency(transactionCosts.total) },
              {
                label: 'Cash needed on day one',
                value: formatCurrency(assessment.upfrontContribution + transactionCosts.total),
                note: 'Your deposit plus the purchase costs above.',
              },
              {
                label: 'Savings left afterwards',
                value: formatCurrency(resilience.savingsRemaining),
              },
              {
                label: 'Emergency buffer',
                value: formatMonths(resilience.bufferMonths),
                note: `We describe this as ${(RESILIENCE_LABELS[resilience.band] ?? resilience.band).toLowerCase()}. There is no universally correct emergency fund, so this describes your position rather than prescribing a target.`,
              },
            ],
          },
        ],
      },
      {
        title: 'Buying compared with renting',
        lede: `We compare two complete strategies by what you would be worth at the end, not by bond repayment against rent. ${horizonNote}`,
        blocks: [
          {
            kind: 'paragraph',
            text: 'If you buy, you spend the deposit and purchase costs now, pay the full cost of owning each month, and end up with equity in a property after the cost of selling it. If you rent, that same cash stays invested, you pay rent each month, and the difference between renting and owning is invested or drawn down. Crediting renting with growth on money you did not spend is what keeps the comparison fair.',
          },
          {
            kind: 'fields',
            fields: [
              { label: 'Period compared', value: `${baseOutcome.years} years` },
              { label: 'Total rent paid over the period', value: formatCurrency(baseOutcome.totalRentPaid) },
              { label: 'Total spent on owning, including upfront costs', value: formatCurrency(baseOutcome.totalOwnershipCost) },
              { label: 'Projected property value at the end', value: formatCurrency(baseOutcome.projectedPropertyValue) },
              { label: 'Outstanding loan at the end', value: formatCurrency(baseOutcome.outstandingLoan) },
              {
                label: 'Equity if you sold',
                value: formatCurrency(baseOutcome.netEquityOnSale),
                note: 'After deducting the cost of selling.',
              },
              {
                label: 'What renting would leave invested',
                value: formatCurrency(baseOutcome.renterInvestedCapital),
              },
              {
                label: 'Net advantage of buying',
                value: formatCurrency(baseOutcome.netAdvantageOfBuying),
                note:
                  baseOutcome.favours === 'buy'
                    ? 'On our central assumptions, buying ends ahead.'
                    : baseOutcome.favours === 'rent'
                      ? 'A negative figure means renting ends ahead on our central assumptions.'
                      : 'The two options land close enough together that we call this neutral.',
              },
            ],
          },
        ],
      },
      {
        title: 'Three different futures',
        lede: 'A single projection would imply a precision we do not have, so the same comparison is run under three views of the future.',
        blocks: [
          {
            kind: 'table',
            columns: ['Scenario', 'Net advantage of buying', 'Points towards'],
            rows: metrics.scenarios.map((scenario) => [
              scenario.label,
              formatCurrency(scenario.outcome.netAdvantageOfBuying),
              FAVOURS_LABELS[scenario.outcome.favours] ?? scenario.outcome.favours,
            ]),
          },
          ...metrics.scenarios.map(
            (scenario): DocumentBlock => ({
              kind: 'paragraph',
              text: `${scenario.label}: ${scenario.description}`,
            }),
          ),
          {
            kind: 'paragraph',
            text: decision.robustness.sensitive
              ? 'These scenarios do not agree with each other. That disagreement is the most important thing on this page: the answer depends on which future turns out to be closer to the truth.'
              : `${decision.robustness.supporting} of ${decision.robustness.total} scenarios point the same way as the recommendation, so it is reasonably stable across the futures we tested.`,
          },
        ],
      },
      {
        title: 'How each part of your situation scored',
        lede: 'These scores are a way of showing you where you stand at a glance. They are not the algorithm: the recommendation is made from the underlying numbers, not from these four values.',
        blocks: [
          {
            kind: 'fields',
            fields: [
              { label: 'Financial position', value: score(metrics.scores.financialPosition) },
              { label: 'Resilience', value: score(metrics.scores.resilience) },
              { label: 'Financial outcome', value: score(metrics.scores.financialOutcome) },
              { label: 'Personal fit', value: score(metrics.scores.personalFit) },
            ],
          },
        ],
      },
      {
        title: 'Why the model reached this recommendation',
        blocks: [
          ...(decision.strongestFactor
            ? [
                {
                  kind: 'callout' as const,
                  title: 'Strongest factor',
                  text: decision.strongestFactor.statement,
                },
              ]
            : []),
          ...(decision.biggestRisk
            ? [
                {
                  kind: 'callout' as const,
                  title: 'Biggest risk',
                  text: decision.biggestRisk.statement,
                },
              ]
            : []),
          { kind: 'bullets', items: decision.reasons.map((reason) => reason.statement) },
        ],
      },
      ...(decision.risks.length > 0
        ? [
            {
              title: 'Risks worth weighing',
              blocks: [
                {
                  kind: 'bullets' as const,
                  items: decision.risks.map(
                    (risk) =>
                      `${risk.severity === 'high' ? 'Important' : risk.severity === 'medium' ? 'Worth watching' : 'Minor'}: ${risk.statement}`,
                  ),
                },
              ],
            },
          ]
        : []),
      ...(decision.whatCouldChange.length > 0
        ? [
            {
              title: 'What could change the result',
              lede: 'Each of these is calculated from your own figures, not offered as general advice.',
              blocks: [
                {
                  kind: 'bullets' as const,
                  items: decision.whatCouldChange.map((lever) => lever.statement),
                },
              ],
            },
          ]
        : []),
      {
        title: 'The assumptions behind this report',
        lede: 'Every one of these is a model assumption, not a forecast. They are listed so you can disagree with them.',
        blocks: [
          {
            kind: 'fields',
            fields: ASSUMPTION_NOTES.map((note) => ({
              label: note.label,
              value: note.value(DEFAULT_ASSUMPTIONS),
              note: note.note,
            })),
          },
        ],
      },
      {
        title: 'What this model does not do',
        blocks: [
          {
            kind: 'bullets',
            items: [
              'It cannot predict the future. Property growth, rental growth and interest rates are assumptions, and the scenario range shows the effect of being wrong rather than bounding what is possible.',
              'Attorney and bond registration fees are approximated. Real conveyancing tariffs are stepped, so treat these as indicative rather than as a quote.',
              'Tax is simplified. There is no capital gains tax, no primary-residence exclusion and no tax treatment of investment returns.',
              'It models one property and one rent, with a national-average growth rate and no regional variation.',
              'The bond is plain vanilla: no access bond, no extra repayments and no fixed-rate option.',
              'This is not a credit assessment. A bank uses your credit history and its own scoring, and may reach a different conclusion.',
              'Everything you entered is self-reported and has not been verified.',
            ],
          },
        ],
      },
      {
        title: 'Using this report responsibly',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Just Wiser is an indicative decision-support tool. It is not financial advice, not a mortgage approval, and not a prediction of what property prices or interest rates will do. It is designed to help you understand your own position well enough to decide for yourself, and to discuss that position with someone qualified.',
          },
          {
            kind: 'paragraph',
            text: `We did not ask for your name, contact details or any other identifying information, and this report is not linked to you. Your assessment reference is ${assessment.id}.`,
          },
        ],
      },
    ],
  };
}

const DISCLAIMER =
  'Just Wiser is an indicative decision-support tool and not financial advice. It is a graduate-programme prototype, is not affiliated with any financial services provider, and does not account for all the circumstances a qualified adviser would consider. Please speak to a qualified financial adviser before making a decision of this size.';
