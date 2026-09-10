/**
 * Upfront costs of buying property in South Africa.
 *
 * These matter far more than customers expect: on a mid-priced home they
 * routinely add 6-8% to the cash needed on day one, which is often the real
 * reason a purchase is not yet affordable. Modelling them is what separates
 * this from a naive "bond payment vs rent" comparison.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import { TRANSFER_DUTY_BANDS } from '../config/transferDuty';
import type { TransactionCosts } from '../models/results';

/**
 * SARS transfer duty, applied on a marginal-band basis.
 *
 * Duty is payable on the portion of the price falling in each band, plus the
 * cumulative duty on all bands below. Properties under the threshold pay none.
 */
export function calculateTransferDuty(propertyPrice: number): number {
  if (propertyPrice <= 0) return 0;

  const band = TRANSFER_DUTY_BANDS.find(
    (b) => propertyPrice > b.from && (b.to === null || propertyPrice <= b.to),
  );
  if (!band) return 0;

  return band.base + (propertyPrice - band.from) * band.rate;
}

/**
 * Total cash required at transfer, over and above the deposit.
 *
 * Attorney fees in practice follow a stepped tariff. We approximate with a
 * proportional-plus-fixed model, which tracks the tariff closely enough for a
 * decision-support estimate and is far easier to keep current. The report
 * labels every one of these as estimated.
 */
export function calculateTransactionCosts(
  propertyPrice: number,
  loanAmount: number,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): TransactionCosts {
  if (propertyPrice <= 0) {
    return {
      transferDuty: 0,
      conveyancing: 0,
      bondRegistration: 0,
      deedsOffice: 0,
      sundries: 0,
      total: 0,
    };
  }

  const t = assumptions.transaction;
  const transferDuty = calculateTransferDuty(propertyPrice);
  const conveyancing = propertyPrice * t.conveyancingRate + t.conveyancingFixed;

  // No bond, no bond registration cost - a cash buyer avoids this entirely.
  const bondRegistration =
    loanAmount > 0 ? loanAmount * t.bondRegistrationRate + t.bondRegistrationFixed : 0;

  const total =
    transferDuty + conveyancing + bondRegistration + t.deedsOfficeFee + t.sundryCosts;

  return {
    transferDuty,
    conveyancing,
    bondRegistration,
    deedsOffice: t.deedsOfficeFee,
    sundries: t.sundryCosts,
    total,
  };
}

/** Estimated cost of selling later - mostly agent commission. */
export function calculateSellingCosts(
  salePrice: number,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): number {
  return Math.max(salePrice, 0) * assumptions.transaction.sellingCostRate;
}
