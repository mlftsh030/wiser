/**
 * Buy vs rent over the customer's expected holding period.
 *
 * The honest comparison is not "bond payment vs rent". It is a net-worth
 * comparison of two complete strategies:
 *
 *   BUY:  spend deposit + purchase costs now, pay ownership costs monthly,
 *         end with equity in a property, less the cost of selling it.
 *
 *   RENT: keep that same cash invested, pay rent monthly, and invest (or draw
 *         on) whatever the monthly difference between renting and owning is.
 *
 * Crediting the renter with investment growth on capital they did not spend is
 * essential. Omitting it is the standard way calculators make buying look
 * better than it is.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import type { Assessment } from '../models/assessment';
import type { ComparisonOutcome, TransactionCosts } from '../models/results';
import { remainingBalance } from './mortgage';
import { runningCostsInYear } from './ownership';
import { calculateSellingCosts } from './transactionCosts';

export interface ComparisonInput {
  assessment: Assessment;
  loanAmount: number;
  annualRate: number;
  monthlyMortgage: number;
  transactionCosts: TransactionCosts;
  years: number;
}

/**
 * A difference this small relative to the numbers involved is noise given the
 * precision of the underlying assumptions, so we call it neutral rather than
 * implying a real winner.
 */
const NEUTRAL_BAND = 0.05;

export function compareBuyVsRent(
  input: ComparisonInput,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): ComparisonOutcome {
  const { assessment, loanAmount, annualRate, monthlyMortgage, transactionCosts, years } = input;
  const { propertyPrice, upfrontContribution, currentRent, loanTermYears } = assessment;
  const r = assumptions.rates;

  const monthlyInvestmentRate = Math.pow(1 + r.investmentReturn, 1 / 12) - 1;
  const monthlyRentGrowth = Math.pow(1 + r.rentalGrowth, 1 / 12) - 1;

  let totalRentPaid = 0;
  let totalOwnershipCost = 0;

  // The renter starts with the cash the buyer spends on day one.
  let renterInvestedCapital = upfrontContribution + transactionCosts.total;

  const months = Math.round(years * 12);

  for (let m = 0; m < months; m++) {
    const year = Math.floor(m / 12);

    const rentThisMonth = currentRent * Math.pow(1 + monthlyRentGrowth, m);
    // The bond payment is fixed; only the running costs inflate.
    const ownThisMonth = monthlyMortgage + runningCostsInYear(propertyPrice, year, assumptions);

    totalRentPaid += rentThisMonth;
    totalOwnershipCost += ownThisMonth;

    // Whoever has the cheaper month invests the difference. When owning costs
    // more, the renter invests the saving; when renting costs more, the renter
    // must draw down. Modelling both directions keeps the comparison fair.
    renterInvestedCapital =
      renterInvestedCapital * (1 + monthlyInvestmentRate) + (ownThisMonth - rentThisMonth);
  }

  const projectedPropertyValue = propertyPrice * Math.pow(1 + r.propertyGrowth, years);
  const outstandingLoan = remainingBalance(
    { loanAmount, annualRate, termYears: loanTermYears },
    months,
  );
  const sellingCosts = calculateSellingCosts(projectedPropertyValue, assumptions);
  const netEquityOnSale = projectedPropertyValue - outstandingLoan - sellingCosts;

  // Both sides paid for somewhere to live, so housing spend is already
  // reflected: the buyer's in totalOwnershipCost, the renter's in the drag on
  // their invested pot. Comparing end-state net worth is therefore sufficient.
  const netAdvantageOfBuying = netEquityOnSale - renterInvestedCapital;

  const scale = Math.max(Math.abs(netEquityOnSale), Math.abs(renterInvestedCapital), 1);
  const relative = netAdvantageOfBuying / scale;

  return {
    years,
    totalRentPaid,
    totalOwnershipCost: totalOwnershipCost + upfrontContribution + transactionCosts.total,
    projectedPropertyValue,
    outstandingLoan,
    netEquityOnSale,
    renterInvestedCapital,
    netAdvantageOfBuying,
    favours:
      relative > NEUTRAL_BAND ? 'buy' : relative < -NEUTRAL_BAND ? 'rent' : 'neutral',
  };
}
