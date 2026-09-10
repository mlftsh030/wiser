import type { CalculatedMetrics } from '../../models/results';
import type { Assessment } from '../../models/assessment';
import { formatCurrency } from '../../utils/format';

/**
 * Side-by-side buy vs rent.
 *
 * A table rather than a chart: these are a handful of exact figures the
 * customer will want to read off and compare, which a bar chart makes harder,
 * not easier.
 */
export function ComparisonTable({
  metrics,
  assessment,
}: {
  metrics: CalculatedMetrics;
  assessment: Assessment;
}) {
  const { baseOutcome, ownershipCosts, horizonYears } = metrics;

  const rows = [
    {
      label: 'Monthly housing cost, today',
      buy: formatCurrency(ownershipCosts.total),
      rent: formatCurrency(assessment.currentRent),
    },
    {
      label: 'Cash needed upfront',
      buy: formatCurrency(assessment.upfrontContribution + metrics.transactionCosts.total),
      rent: formatCurrency(0),
    },
    {
      label: `Total housing spend over ${horizonYears} years`,
      buy: formatCurrency(baseOutcome.totalOwnershipCost),
      rent: formatCurrency(baseOutcome.totalRentPaid),
    },
    {
      label: `What you'd be left holding after ${horizonYears} years`,
      buy: formatCurrency(baseOutcome.netEquityOnSale),
      rent: formatCurrency(baseOutcome.renterInvestedCapital),
      emphasis: true,
    },
  ];

  return (
    <div className="table-scroll">
      <table className="compare">
        <caption className="sr-only">
          Comparison of buying and renting over {horizonYears} years
        </caption>
        <thead>
          <tr>
            <th scope="col">&nbsp;</th>
            <th scope="col">Buying</th>
            <th scope="col">Renting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.emphasis ? 'compare__row--emphasis' : undefined}>
              <th scope="row">{row.label}</th>
              <td>{row.buy}</td>
              <td>{row.rent}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">
        "What you'd be left holding" is the equity in the property after selling costs, compared
        with the money a renter would have if they invested the deposit and purchase costs instead
        and kept investing the monthly difference. All figures are estimates based on our
        assumptions.
      </p>
    </div>
  );
}
