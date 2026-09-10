import { ComparisonTable } from '../components/report/ComparisonTable';
import { ScenarioRange } from '../components/report/ScenarioRange';
import { Button, Callout, Card, Disclosure, ScoreMeter, Stat } from '../components/ui';
import { ASSUMPTION_NOTES, DEFAULT_ASSUMPTIONS } from '../config/assumptions';
import { TRANSFER_DUTY_TAX_YEAR } from '../config/transferDuty';
import type { ReportModel } from '../models/results';
import { formatCurrency, formatMonths, formatPercent } from '../utils/format';

const RESILIENCE_WORDS: Record<string, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  limited: 'Limited',
  very_limited: 'Very limited',
};

export function ResultPage({
  report,
  onDownload,
  onRestart,
  downloadState,
}: {
  report: ReportModel;
  onDownload: () => void;
  onRestart: () => void;
  downloadState: 'idle' | 'working' | 'error';
}) {
  const { metrics, decision, assessment, explanation } = report;
  return (
    <div className="step-enter result">
      {/* 1. Your recommendation */}
      <header className="result__head">
        <p className="eyebrow">Here's what we found.</p>
        <h1 className="result__headline">{decision.headline}</h1>
        <p className="result__summary">{decision.summary}</p>
        <p className="result__caveat">
          This is decision support, not financial advice. It is based entirely on the figures you
          gave us and the assumptions we list at the bottom of this page.
        </p>
      </header>

      {/* The strongest factor and the biggest risk, before any detail. */}
      <div className="result__highlights">
        {decision.strongestFactor ? (
          <Callout title="Your strongest factor" tone="positive">
            <p>{decision.strongestFactor.statement}</p>
          </Callout>
        ) : null}

        {decision.biggestRisk ? (
          <Callout
            title="Your biggest risk"
            tone={decision.biggestRisk.severity === 'high' ? 'warning' : 'caution'}
          >
            <p>{decision.biggestRisk.statement}</p>
          </Callout>
        ) : null}
      </div>

      {/* 2. At a glance */}
      <section className="result__section" aria-labelledby="glance">
        <h2 id="glance">At a glance</h2>
        <p className="section-lede">
          These four scores summarise the analysis. They are a way of showing you which parts of
          your situation are strong and which are not - the recommendation itself comes from the
          financial rules below, not from adding these up.
        </p>

        <Card tone="sunken">
          <ScoreMeter
            label="Financial position"
            score={metrics.scores.financialPosition}
            description="Can your income comfortably carry the monthly cost?"
          />
          <ScoreMeter
            label="Financial resilience"
            score={metrics.scores.resilience}
            description="What cushion would you have left afterwards?"
          />
          <ScoreMeter
            label="Long-term financial outcome"
            score={metrics.scores.financialOutcome}
            description="How do buying and renting compare over your expected stay?"
          />
          <ScoreMeter
            label="Personal fit"
            score={metrics.scores.personalFit}
            description="Does owning suit your plans and what you told us you value?"
          />
        </Card>

        <div className="robustness">
          <h3>Recommendation robustness</h3>
          <p className="robustness__value">
            {decision.robustness.supporting} / {decision.robustness.total} scenarios support this
            result
          </p>
          <p className="robustness__note">
            {decision.robustness.sensitive
              ? 'This result changes depending on future assumptions. That is worth taking seriously.'
              : 'The result holds up across all the futures we tested.'}{' '}
            This measures how sensitive the answer is to our assumptions. It is not a statistical
            confidence level, and it is not a probability.
          </p>
        </div>
      </section>

      {/* 3. Why we reached this result */}
      <section className="result__section" aria-labelledby="why">
        <h2 id="why">Why we reached this result</h2>
        <p className="explanation">{explanation}</p>

        <ul className="reasons">
          {decision.reasons.map((reason, index) => (
            <li key={index} className={`reason reason--${reason.impact}`}>
              <span className={`reason__marker reason__marker--${reason.impact}`} aria-hidden="true" />
              <div>
                <span className="reason__impact">
                  {reason.impact === 'positive'
                    ? 'Supports buying'
                    : reason.impact === 'negative'
                      ? 'Counts against buying'
                      : 'Neutral'}
                </span>
                <p>{reason.statement}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Your financial position */}
      <section className="result__section" aria-labelledby="position">
        <h2 id="position">Your financial position</h2>
        <dl className="stats">
          <Stat
            label="Monthly bond repayment"
            value={formatCurrency(metrics.mortgage.monthlyPayment)}
            hint={
              metrics.mortgage.usedDefaultRate
                ? `Assumed rate of ${formatPercent(metrics.mortgage.annualRate, 2)}`
                : `At ${formatPercent(metrics.mortgage.annualRate, 2)} over ${assessment.loanTermYears} years`
            }
          />
          <Stat
            label="Full monthly cost of owning"
            value={formatCurrency(metrics.ownershipCosts.total)}
            hint="Bond, rates, insurance and maintenance"
          />
          <Stat
            label="Left over each month"
            value={formatCurrency(metrics.position.monthlySurplusAfterHousing)}
            hint="After essentials, debt and housing"
            tone={metrics.position.monthlySurplusAfterHousing < 0 ? 'warning' : 'default'}
          />
          <Stat
            label="Cash needed upfront"
            value={formatCurrency(assessment.upfrontContribution + metrics.transactionCosts.total)}
            hint="Deposit plus estimated purchase costs"
          />
          <Stat
            label="Savings left afterwards"
            value={formatCurrency(metrics.resilience.savingsRemaining)}
            hint={`${RESILIENCE_WORDS[metrics.resilience.band]} - about ${formatMonths(
              metrics.resilience.bufferMonths,
            )} of essential expenses`}
            tone={
              metrics.resilience.band === 'strong'
                ? 'positive'
                : metrics.resilience.band === 'moderate'
                  ? 'default'
                  : 'warning'
            }
          />
          <Stat
            label="Share of income on housing"
            value={formatPercent(metrics.position.housingCostRatio, 0)}
            hint="Of your take-home income"
          />
        </dl>

        <Disclosure summary="See how the monthly cost breaks down">
          <dl className="breakdown">
            <div><dt>Bond repayment</dt><dd>{formatCurrency(metrics.ownershipCosts.mortgage)}</dd></div>
            <div><dt>Rates and taxes</dt><dd>{formatCurrency(metrics.ownershipCosts.ratesAndTaxes)}</dd></div>
            <div><dt>Building insurance</dt><dd>{formatCurrency(metrics.ownershipCosts.insurance)}</dd></div>
            <div><dt>Maintenance allowance</dt><dd>{formatCurrency(metrics.ownershipCosts.maintenance)}</dd></div>
            <div className="breakdown__total"><dt>Total each month</dt><dd>{formatCurrency(metrics.ownershipCosts.total)}</dd></div>
          </dl>
          <p className="table-note">
            Rates, insurance and maintenance are estimated from the property price. They are the
            costs people most often leave out when comparing a bond payment with rent.
          </p>
        </Disclosure>

        <Disclosure summary="See the estimated upfront costs">
          <dl className="breakdown">
            <div><dt>Transfer duty ({TRANSFER_DUTY_TAX_YEAR} SARS rates)</dt><dd>{formatCurrency(metrics.transactionCosts.transferDuty)}</dd></div>
            <div><dt>Conveyancing and transfer</dt><dd>{formatCurrency(metrics.transactionCosts.conveyancing)}</dd></div>
            <div><dt>Bond registration</dt><dd>{formatCurrency(metrics.transactionCosts.bondRegistration)}</dd></div>
            <div><dt>Deeds Office</dt><dd>{formatCurrency(metrics.transactionCosts.deedsOffice)}</dd></div>
            <div><dt>Other disbursements</dt><dd>{formatCurrency(metrics.transactionCosts.sundries)}</dd></div>
            <div className="breakdown__total"><dt>Estimated total</dt><dd>{formatCurrency(metrics.transactionCosts.total)}</dd></div>
          </dl>
          <p className="table-note">
            Estimated. Transfer duty follows the current SARS bands; attorney fees follow a stepped
            tariff that we approximate. Your attorney will quote you exactly.
          </p>
        </Disclosure>
      </section>

      {/* 5. Buying vs renting */}
      <section className="result__section" aria-labelledby="compare">
        <h2 id="compare">Buying vs renting</h2>
        <p className="section-lede">
          Over the {metrics.horizonYears} years you expect to stay
          {metrics.horizonAssumed ? ' (we assumed five years, since you were not sure)' : ''}, on
          our central assumptions.
        </p>
        <ComparisonTable metrics={metrics} assessment={assessment} />
      </section>

      {/* 6. Scenarios */}
      <section className="result__section" aria-labelledby="scenarios">
        <h2 id="scenarios">What happens under different scenarios</h2>
        <p className="section-lede">
          Nobody knows what property will do. Rather than pretend otherwise, we ran the same
          comparison against three different views of the future.
        </p>
        <ScenarioRange scenarios={metrics.scenarios} />
      </section>

      {/* 7. What could change the result */}
      <section className="result__section" aria-labelledby="change">
        <h2 id="change">What could change the result?</h2>
        <ul className="levers">
          {decision.whatCouldChange.map((lever, index) => (
            <li key={index} className="lever">
              {lever.statement}
            </li>
          ))}
        </ul>
      </section>

      {/* 8. Risks / next steps */}
      {decision.risks.length > 0 ? (
        <section className="result__section" aria-labelledby="risks">
          <h2 id="risks">What you could consider next</h2>
          <ul className="risks">
            {decision.risks.map((risk, index) => (
              <li key={index} className={`risk risk--${risk.severity}`}>
                <span className={`tag tag--${risk.severity === 'high' ? 'warning' : 'caution'}`}>
                  {risk.severity === 'high' ? 'Important' : 'Worth watching'}
                </span>
                <p>{risk.statement}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 9. Assumptions */}
      <section className="result__section" aria-labelledby="assumptions">
        <h2 id="assumptions">Assumptions</h2>
        <p className="section-lede">
          Every one of these is a model assumption, not a forecast. If you disagree with one, the
          answer above may well change - which is exactly why we show them.
        </p>
        <Disclosure summary="See the assumptions behind this analysis">
          <dl className="assumptions">
            {ASSUMPTION_NOTES.map((note) => (
              <div key={note.label}>
                <dt>
                  {note.label} <span className="assumptions__value">{note.value(DEFAULT_ASSUMPTIONS)}</span>
                </dt>
                <dd>{note.note}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </section>

      {/* 10. Disclaimer and actions */}
      <section className="result__section result__actions" aria-labelledby="next">
        <h2 id="next">Keep a copy</h2>
        <p className="section-lede">
          Your assessment reference is <strong>{assessment.id}</strong>. We did not ask for your
          name or contact details, and this report is not linked to you.
        </p>
        <p className="section-lede">
          The PDF contains everything on this page: your figures, the full comparison, all three
          scenarios, the reasoning, the risks, what could change the result, and the assumptions
          behind it.
        </p>

        <div className="button-row">
          <Button onClick={onDownload} disabled={downloadState === 'working'}>
            {downloadState === 'working' ? 'Preparing your PDF…' : 'Download my detailed report (PDF)'}
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            Start again
          </Button>
        </div>

        {downloadState === 'error' ? (
          <div className="inline-note inline-note--warning" role="alert">
            <p>
              Something went wrong while preparing your PDF. Your result is still here on this
              page, so please try again.
            </p>
          </div>
        ) : null}

        <p className="disclaimer">
          Just Wiser is an indicative decision-support tool. It is not financial advice, not a
          mortgage approval, and not a prediction of what property or interest rates will do. The
          figures are estimates produced from the information you entered and the assumptions
          listed above. Please speak to a qualified financial adviser before making a decision of
          this size.
        </p>
      </section>
    </div>
  );
}
